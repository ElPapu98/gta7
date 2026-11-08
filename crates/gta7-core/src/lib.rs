//! Deterministic simulation core. Single-threaded API, suitable for native and wasm32.
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Clone, Serialize, Deserialize)]
pub struct Citizen {
    pub id: u32,
    pub x: f32,
    pub y: f32,
    pub home: [f32; 2],
    pub work: [f32; 2],
    pub state: CitizenState,
    pub memories: Vec<Memory>,
}

#[derive(Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum CitizenState { Home, Work, Flee }

#[derive(Clone, Serialize, Deserialize)]
pub struct Memory { pub event_id: u32, pub witnessed_at: f32, pub confidence: f32 }

#[derive(Clone, Serialize, Deserialize)]
pub struct Crime { pub id: u32, pub x: f32, pub y: f32, pub witnesses: Vec<u32>, pub reported: bool }

#[derive(Serialize, Deserialize)]
pub struct City {
    pub tick: u64,
    pub minutes: f32,
    pub citizens: Vec<Citizen>,
    pub crimes: Vec<Crime>,
    seed: u32,
}

fn next_random(seed: &mut u32) -> f32 {
    *seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
    *seed as f32 / 4_294_967_296.0
}

impl City {
    pub fn new(seed: u32, population: u32) -> Self {
        let mut rand_state = seed;
        let mut citizens = Vec::with_capacity(population as usize);
        for id in 0..population {
            let home = [next_random(&mut rand_state) * 1200.0, next_random(&mut rand_state) * 1200.0];
            let work = [next_random(&mut rand_state) * 1200.0, next_random(&mut rand_state) * 1200.0];
            citizens.push(Citizen { id, x: home[0], y: home[1], home, work, state: CitizenState::Home, memories: Vec::new() });
        }
        Self { tick: 0, minutes: 480.0, citizens, crimes: Vec::new(), seed }
    }

    pub fn advance(&mut self, seconds: f32) {
        let dt = seconds.clamp(0.0, 0.1);
        self.tick += 1;
        self.minutes += dt * 3.0;
        let hour = (self.minutes / 60.0) % 24.0;
        for citizen in &mut self.citizens {
            citizen.state = if (8.0..18.0).contains(&hour) { CitizenState::Work } else { CitizenState::Home };
            let target = if citizen.state == CitizenState::Work { citizen.work } else { citizen.home };
            let dx = target[0] - citizen.x;
            let dy = target[1] - citizen.y;
            let distance = (dx * dx + dy * dy).sqrt();
            if distance > 0.01 {
                let movement = (dt * 14.0).min(distance);
                citizen.x += dx / distance * movement;
                citizen.y += dy / distance * movement;
            }
        }
    }

    pub fn register_crime(&mut self, x: f32, y: f32) -> u32 {
        let id = self.crimes.len() as u32 + 1;
        let witnesses = self.citizens.iter_mut().filter_map(|citizen| {
            let dx = citizen.x - x;
            let dy = citizen.y - y;
            if dx * dx + dy * dy > 115.0 * 115.0 { return None; }
            citizen.memories.push(Memory { event_id: id, witnessed_at: self.minutes, confidence: 1.0 });
            Some(citizen.id)
        }).collect();
        self.crimes.push(Crime { id, x, y, witnesses, reported: false });
        id
    }
}

#[wasm_bindgen]
pub struct GameCore { city: City }

#[wasm_bindgen]
impl GameCore {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32, population: u32) -> Self { Self { city: City::new(seed, population) } }
    pub fn step(&mut self, dt: f32) { self.city.advance(dt); }
    pub fn crime(&mut self, x: f32, y: f32) -> u32 { self.city.register_crime(x, y) }
    pub fn state(&self) -> Result<JsValue, JsValue> { serde_wasm_bindgen::to_value(&self.city).map_err(|e| JsValue::from_str(&e.to_string())) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn same_seed_same_state() {
        let mut a = City::new(13, 100);
        let mut b = City::new(13, 100);
        for _ in 0..100 { a.advance(1.0 / 30.0); b.advance(1.0 / 30.0); }
        assert_eq!(a.citizens[10].x, b.citizens[10].x);
    }
    #[test]
    fn witness_has_memory() {
        let mut city = City::new(3, 1);
        let citizen = &city.citizens[0];
        let (x, y) = (citizen.x, citizen.y);
        city.register_crime(x, y);
        assert_eq!(city.citizens[0].memories.len(), 1);
    }
}
