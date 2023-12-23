import {
    $update,
    $query,
    Record,
    match,
    Result,
    text,
    int,
    Vec,
    Variant,
    Opt,
    ic,
    nat64,
    StableBTreeMap,
  } from 'azle';
  import { v4 as uuidv4 } from "uuid";
  
  type Candidate = Record<{
    id: string;
    natIdentificationNumber: int;
    citizenIds: Vec<string>;
    name: text;
  }>;
  
  type Citizen = Record<{
    id: string;
    natIdentificationNumber: int;
    name: text;
    candidateId: string;
  }>;
  
  type ResultPolling = Record<{
    id: string;
    name: text;
    count: nat64;
  }>;
  
  type DataError = Variant<{
    CitizenDoesNotExist: string;
    CandidateDoesNotExist: string;
  }>;
  
  const candidates = new StableBTreeMap<string, Candidate>(0, 44, 1024);
  const citizens = new StableBTreeMap<string, Citizen>(1, 44, 1024);
  const resultPollings = new StableBTreeMap<string, ResultPolling>(2, 44, 1024);
  
  $update
  export function createCandidate(name: string, natIdentificationNumber: nat64): Result<Candidate, string> {
    // Validate that the provided Parameter is not empty
    if ( !name || natIdentificationNumber > 0) {
      return Result.Err<Candidate, string>('Invalid ID provided.');
    }
    try {
      const id = uuidv4();
  
      return match(candidates.get(id), {
        Some: () => Result.Err<Candidate, string>("Candidate ID already exists"),
        None: () => {
          // Create a new candidate
          const newCandidate: Candidate = {
            id,
            name,
            natIdentificationNumber,
            citizenIds: [],
          };
          candidates.insert(id, newCandidate);
          return Result.Ok<Candidate, string>(newCandidate);
        },
      });
    } catch (error) {
      return Result.Err<Candidate, string>(`Error creating candidate: ${error}`);
    }
  }
  
  $query
  export function readPolling(): Result<Vec<ResultPolling>, string> {
    try {
      
      if (!resultPollings.isEmpty()) {
        // Return cached polling results
        return Result.Ok<Vec<ResultPolling>, string>(resultPollings.values());
      }
  
      const data = candidates.values();
      const results: ResultPolling[] = data.map((x) => ({
        id: x.id,
        name: x.name,
        count: BigInt(x.citizenIds.length),
      }));
  
      results.forEach((result) => {
        resultPollings.insert(result.id, result);
      });
  
      // Return newly calculated polling results
      return Result.Ok<Vec<ResultPolling>, string>(results);
    } catch (error) {
      return Result.Err<Vec<ResultPolling>, string>(`Error reading polling data: ${error}`);
    }
  }
  
  $query
  export function readCandidates(): Result<Vec<Candidate>, string> {
    try {
      if (!candidates.isEmpty()) {
        // Return existing candidates
        return Result.Ok<Vec<Candidate>, string>(candidates.values());
      } else {
        // Return an empty array if no candidates exist
        return Result.Ok<Vec<Candidate>, string>([]);
      }
    } catch (error) {
      return Result.Err<Vec<Candidate>, string>(`Error reading candidates: ${error}`);
    }
  }
  
  $update
  export function createCitizenAndVote(name: string, natIdentificationNumber: int, candidateId: string): Result<Citizen, string> {
    // Validate that the provided Parameter is not empty
    if (!candidateId || !name || natIdentificationNumber > 0) {
      return Result.Err<Citizen, string>('Invalid ID provided.');
    }
    try {
      return match(candidates.get(candidateId), {
        Some: (candidate) => {
          const id = uuidv4();
          const newCitizen: Citizen = {
            id,
            name,
            natIdentificationNumber,
            candidateId,
          };
  
          citizens.insert(newCitizen.id, newCitizen);
  
          const updatedCandidate: Candidate = {
            ...candidate,
            citizenIds: [...candidate.citizenIds, newCitizen.id],
          };
  
          candidates.insert(updatedCandidate.id, updatedCandidate);
  
          // Return the newly created citizen
          return Result.Ok<Citizen, string>(newCitizen);
        },
        None: () => Result.Err<Citizen, string>("CandidateDoesNotExist"),
      });
    } catch (error) {
      return Result.Err<Citizen, string>("CandidateDoesNotExist");
    }
  }
  
  $query
  export function readCitizens(): Result<Vec<Citizen>, string> {
    try {
      if (!citizens.isEmpty()) {
        // Return existing citizens
        return Result.Ok<Vec<Citizen>, string>(citizens.values());
      } else {
        // Return an empty array if no citizens exist
        return Result.Ok<Vec<Citizen>, string>([]);
      }
    } catch (error) {
      return Result.Err<Vec<Citizen>, string>(`Error reading citizens: ${error}`);
    }
  }
  
  $query
  export function readCitizenById(id: string): Result<Opt<Citizen>, string> {
    try {
      // Validate that the provided ID is not empty
      if (!id) {
        return Result.Err<Opt<Citizen>, string>('Invalid ID provided.');
      }
      // Return the citizen by ID or an empty result if not found
      return Result.Ok(citizens.get(id));
    } catch (error) {
      return Result.Err<Opt<Citizen>, string>(`Error reading citizen by ID: ${error}`);
    }
  }
  
  // Cryptographic utility for generating random values
  globalThis.crypto = {
    // @ts-ignore
    getRandomValues: () => {
      let array = new Uint8Array(32);
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
  };
  