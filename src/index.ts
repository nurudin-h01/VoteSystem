import {
    blob,
    Canister,
    ic,
    Err,
    nat64,
    Ok,
    Opt,
    Principal,
    query,
    Record,
    Result,
    StableBTreeMap,
    text,
    update,
    Variant,
    Vec,
    int
} from 'azle';

const Candidate = Record({
    id: Principal,
    natIdentificationNumber: int,
    citizenIds: Vec(Principal),
    name: text
});
type Candidate = typeof Candidate.tsType;

const ResultPolling = Record({
    id: Principal,
    name: text,
    count: BigInt
})
type ResultPolling = typeof ResultPolling.tsType;

const Citizen = Record({
    id: Principal,
    natIdentificationNumber: int,
    name: text,
    candidateId: Principal
});
type Citizen = typeof Citizen.tsType;

const DataError = Variant({
    CitizenDoesNotExist: Principal,
    CandidateDoesNotExist: Principal
});
type DataError = typeof DataError.tsType;

let candidates = StableBTreeMap<Principal, Candidate>(0);
let citizens = StableBTreeMap<Principal, Citizen>(1);
let resultPollings = StableBTreeMap<Principal, ResultPolling>(2);

export default Canister({
    createCandidate: update([text, int], Candidate, (name, natIdentificationNumber) => {
        const id = Principal.fromText(`${name}-${natIdentificationNumber}-${ic.time()}`)
        const candidate: Candidate = {
            id,
            name,
            natIdentificationNumber,
            citizenIds: []
        };
        candidates.insert(candidate.id, candidate);
        return candidate;
    }),
    readPolling: query([], Vec(ResultPolling), () => {
        if (candidates.isEmpty()) {
            return [];
        }

        const results = candidates.values().map((candidate) => ({
            id: candidate.id,
            name: candidate.name,
            count: BigInt(candidate.citizenIds.length)
        }));

        resultPollings.clear();
        resultPollings.batchInsert(results.map((result) => [result.id, result]));

        return results;
    }),
    readCandidates: query([], Vec(Candidate), () => {
        return candidates.values();
    }),

    createCitizenAndVote: update(
        [text, int, Principal],
        Result(Citizen, DataError),
        (name, natIdentificationNumber, candidateId) => {
            const candidate = candidates.get(candidateId);

            if ('None' in candidate) {
                return Err({
                    CandidateDoesNotExist: candidateId
                });
            }

            const id = Principal.fromText(`${name}-${natIdentificationNumber}-${ic.time()}`);
            const citizen: Citizen = {
                id,
                name,
                natIdentificationNumber,
                candidateId
            };

            citizens.insert(citizen.id, citizen);

            const updatedCandidate: Candidate = {
                ...candidate.Some,
                citizenIds: [...candidate.Some.citizenIds, citizen.id]
            };

            candidates.insert(updatedCandidate.id, updatedCandidate);

            return Ok(citizen);
        }
    ),
    readCitizens: query([], Vec(Citizen), () => {
        return citizens.values();
    }),
    readCitizenById: query([Principal], Opt(Citizen), (id) => {
        return citizens.get(id);
    }),
});
