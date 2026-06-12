# 신규 식별자 충돌 검토 — spec-draft-code-node-followups

대상: `plan/in-progress/spec-draft-code-node-followups.md`

---

## 발견사항

### 1. WARNING — `ISOLATE_MEMORY_LIMIT_MB` vs `CODE_NODE_MEMORY_LIMIT_MB` 명칭 전환

- **target 신규 식별자**: `CODE_NODE_MEMORY_LIMIT_MB` (변경 3, §3-a)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/data/code/code.handler.ts` line 20: `const ISOLATE_MEMORY_LIMIT_MB = 128;` (모듈 상수)
  - 같은 파일 line 17 W15 주석: "Can be extracted to `CODE_NODE_MEMORY_LIMIT_MB`" — 즉 두 이름이 같은 파일에서 의도적으로 공존하며, 모듈 상수는 `ISOLATE_MEMORY_LIMIT_MB`, W15 주석이 제안하는 env 이름은 `CODE_NODE_MEMORY_LIMIT_MB`
  - `/Volumes/project/private/clemvion/plan/in-progress/code-node-isolated-vm-followups.md` line 21: `ISOLATE_MEMORY_LIMIT_MB` → `CODE_NODE_MEMORY_LIMIT_MB` 전환을 명시적으로 예고
- **상세**: 현재 코드 내 모듈 상수 이름은 `ISOLATE_MEMORY_LIMIT_MB` 이지만, target spec 과 plan 모두 `CODE_NODE_MEMORY_LIMIT_MB` 를 env var 이름으로 지정한다. 두 이름은 서로 다른 레이어(코드 내 상수 vs 환경변수)를 가리키므로 실제 의미 충돌은 없다. 단 코드 상수 `ISOLATE_MEMORY_LIMIT_MB` 는 후속 code PR 에서 env 파싱 로직으로 교체될 때 이름 변경이 필요한데, spec 이 env 이름만 명시하고 코드 상수 이름 변경 여부를 언급하지 않아 code PR 작성자가 헷갈릴 수 있다.
- **제안**: target 의 `CODE_NODE_MEMORY_LIMIT_MB` 명칭은 적절하다. 다만 "후속 code PR" 설명에 `ISOLATE_MEMORY_LIMIT_MB` 모듈 상수도 동시에 교체·삭제된다는 것을 명시하면 혼동이 없어진다.

---

### 2. INFO — `ivm.Isolate.createSnapshot` 식별자 — spec 에 신규 도입, 기존 사용처와 충돌 없음

- **target 신규 식별자**: `ivm.Isolate.createSnapshot()` (변경 1, §1-b)
- **기존 사용처**: spec 어디에도 `createSnapshot` 이 사용된 적 없다. plan 파일 `code-node-isolated-vm-followups.md` line 22 에 구현 완료 기록으로만 등장.
- **상세**: spec 에 처음 도입되는 기술 식별자이며 다른 spec 에서 동일 이름으로 다른 의미를 부여한 사례가 없다. 충돌 없음.
- **제안**: 없음.

---

### 3. INFO — `$helpers.base64` 행 보강 — 기존 정의와 계약 변경

- **target 신규 식별자**: `$helpers.base64.encode(data)` / `$helpers.base64.decode(data)` 비문자열 입력 시 `TypeError` 계약 (변경 2, §2-a)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/4-nodes/5-data/2-code.md` §2.2 표: 기존에 `$helpers.base64.encode(data)` 는 "Base64 인코딩" 설명만 있으며 입력 타입 제약이 없음
  - 같은 파일 `code.handler.ts` 에서 현재 `String(data)` 묵시적 강제변환을 사용 중 (이를 `TypeError` 로 변경하는 것이 target 의 목적)
- **상세**: `TypeError` 계약은 spec §2.2 에 존재하는 기존 정의를 확장하는 것으로, 다른 spec 영역에서 `$helpers.base64` 를 다른 의미로 참조하는 사례는 없다. 단, 의미 변경(하위 호환 영향)이 동반되므로 식별자 충돌보다는 계약 변경 사항이다. spec 내 `$helpers.base64` 유일 정의처가 `2-code.md §2.2` 이므로 충돌은 없다.
- **제안**: 없음.

---

### 4. INFO — `CODE_MEMORY_LIMIT` 에러코드 — 기존 정의와 일치

- **target 신규 식별자**: 변경 3 에서 `CODE_MEMORY_LIMIT` 에러코드를 언급 (§3-a)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/4-nodes/5-data/2-code.md` §5.3.3, §7.2 에 이미 `CODE_MEMORY_LIMIT` 정의됨
  - `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` line 83 에 "isolate 128MB 하드 리밋 초과" 로 등록됨
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/core/error-codes.ts` line 49 에 구현됨
- **상세**: target 은 기존 정의를 재사용하며 새 의미를 부여하지 않는다. 충돌 없음.
- **제안**: 없음.

---

### 5. INFO — 파일 경로 — `spec/4-nodes/5-data/2-code.md` 단일 파일 수정, 경로 충돌 없음

- **target 신규 식별자**: 변경 대상 파일 경로 `spec/4-nodes/5-data/2-code.md`
- **기존 사용처**: 해당 파일은 이미 존재하며, `spec/4-nodes/5-data/` 디렉터리에 `0-common.md` / `1-transform.md` / `2-code.md` 만 존재. target 이 신규 파일을 생성하지 않으므로 경로 충돌 없음.
- **제안**: 없음.

---

## 요약

target 문서(`spec-draft-code-node-followups.md`)가 도입하는 신규 식별자 중 실질적 충돌은 발견되지 않았다. 가장 주목할 점은 환경변수 이름 `CODE_NODE_MEMORY_LIMIT_MB` 로, 현재 코드 내 상수 `ISOLATE_MEMORY_LIMIT_MB` 와 이름이 다르지만 이는 코드 상수와 env var 이름이 서로 다른 레이어를 지칭하는 의도적 선택이며(W15 주석이 이미 예고), plan(`code-node-isolated-vm-followups.md` line 21)도 이 전환을 명시하고 있어 충돌이 아니다. `$helpers.base64` 계약 변경은 단일 정의처(`2-code.md §2.2`) 수정이므로 다른 spec 과 충돌하지 않는다. `createSnapshot`, `CODE_MEMORY_LIMIT` 등 나머지 식별자도 기존 다른 의미와 겹치지 않는다.

## 위험도

LOW
