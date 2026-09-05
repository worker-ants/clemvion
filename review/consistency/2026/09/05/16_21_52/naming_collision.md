# 신규 식별자 충돌 검토 — `spec-draft-api-convention-verifier-registration.md`

## 검토 범위 요약

target 이 실제로 도입하는 신규 식별자는 예상보다 좁다 — 이 planner 턴은 **새 엔티티·DTO·endpoint·이벤트·ENV var 를 만들지 않는다.** 변경은 다음 세 종류로 국한된다:

1. `spec/5-system/2-api-convention.md` frontmatter `code:` 에 기존 파일 2개 경로 추가 (`response-contract.ts`, `swagger-probe.ts`)
2. `spec/conventions/swagger.md` frontmatter `code:` 에 기존 파일 1개 경로 추가 (`swagger-probe.ts`)
3. 새 섹션 제목 2개 신설 — `2-api-convention.md` 의 §5.4 말미 "검증 층" 문단, `## Overview (제품 정의)` 헤딩

이 세 종류를 기준으로 6개 관점을 실측했다.

## 실측 결과

### 1. 요구사항 ID 충돌 — 해당 없음
target 은 신규 요구사항 ID(`NAV-*`, `EH-*` 류)를 부여하지 않는다. 등재 대상은 코드 경로와 산문 설명뿐이다.

### 2. 엔티티/타입명 충돌 — 없음 (기존 구분 재확인)
target 은 새 타입명을 만들지 않고, 오히려 **기존에 이미 분리돼 있는 두 타입**의 경계를 문서화한다.
```
codebase/backend/src/shared/testing/response-contract.ts:78:export interface ContractViolation {
codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:34:export interface ContractMismatch {
```
전수 grep 결과 `ContractViolation` 은 `response-contract.ts`/`.spec.ts` 에만, `ContractMismatch` 는 `swagger-dto-contract-guard.ts`/`.spec.ts` 에만 나타난다 — 코드베이스 어디에도 동명이의로 재사용되는 자리가 없다. target 이 "리네임하지 않는다"고 결정한 근거(두 이름이 이미 서로 다르다)가 실측과 일치한다.

### 3. API endpoint 충돌 — 해당 없음
target 은 신규 endpoint 를 정의하지 않는다.

### 4. 이벤트/메시지명 충돌 — 해당 없음
webhook/queue/SSE 이벤트명 신설 없음.

### 5. 환경변수·설정키 충돌 — 해당 없음
신규 ENV var·config key 없음.

### 6. 파일 경로/헤딩 충돌 — 없음 (교차검증 완료)

**`code:` 중복 등재 여부**: 저장소 전체 spec 을 대상으로 두 파일 경로가 이미 다른 spec 의 `code:` 에 등재돼 있는지 확인했다.
```
grep -rn "response-contract.ts" spec/   → (기존 매치 없음, target 편집 전 기준)
grep -rn "swagger-probe.ts" spec/       → (기존 매치 없음)
```
두 파일 모두 어떤 spec 의 frontmatter 에도 아직 등재돼 있지 않다 — target 의 "게이트가 이 파일을 spec-linked 로 못 본다"는 전제와 일치하며, 새 등재가 기존 등재와 겹치지 않는다.

**`swagger-dto-contract*.ts` glob 과의 교차 여부**: `swagger.md` 의 기존 `code:` 는 `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts` glob 하나로 `swagger-dto-contract-guard.ts`/`swagger-dto-contract.spec.ts` 를 잡는다. 이 glob 은 파일명이 다른 `response-contract.ts`·`swagger-probe.ts` 와 매치하지 않으므로, target 이 두 파일을 별도 라인으로 명시 추가하는 것은 기존 glob 과 충돌하지 않고 정확히 보완적이다.

**`## Overview (제품 정의)` 헤딩 충돌**: 이 정확한 헤딩 문자열이 이미 저장소 관행으로 존재한다.
```
spec/5-system/10-graph-rag.md:32:## Overview (제품 정의)
spec/5-system/12-webhook.md:21:## Overview (제품 정의)
spec/5-system/13-replay-rerun.md:20:## Overview (제품 정의)
spec/5-system/15-chat-channel.md:32:## Overview (제품 정의)
spec/5-system/14-external-interaction-api.md:39:## Overview (제품 정의)
spec/5-system/17-agent-memory.md:14:## Overview (제품 정의)
spec/5-system/9-rag-search.md:19:## Overview (제품 정의)
spec/5-system/8-embedding-pipeline.md:21:## Overview (제품 정의)
```
`5-system/` 안에서만 이미 8개 문서가 동일 헤딩을 쓴다. target 이 `2-api-convention.md` 에 같은 문구를 신설하는 것은 **새 명명을 발명하는 것이 아니라 기존 다수파 관행에 합류**하는 것이며, 앵커(`#overview-제품-정의`)도 각 문서 로컬이라 문서간 충돌이 없다(마크다운 앵커는 문서 스코프).

**"검증 층" 섹션 제목**: 저장소 전체에서 `grep -rn "검증-층\|검증층\|#검증" spec/` 매치 0건 — 기존에 쓰인 적 없는 새 소제목이고, 다른 문서의 앵커·용어와 충돌하지 않는다.

## 종합 평가

target 이 새로 발명하는 식별자는 사실상 없다 — 등재하는 두 코드 경로는 이미 존재하는 파일이고, 어느 spec 에도 아직 중복 등재돼 있지 않다. 신설하는 헤딩(`## Overview (제품 정의)`)은 `spec/5-system/` 내 8개 자매 문서가 이미 쓰는 정확히 동일한 문구라 새 명명 충돌을 만들 수 없고, 나머지 신설 소제목("검증 층")은 저장소 전역에 선례가 없는 진짜 신규 문자열이라 기존 어떤 것과도 겹치지 않는다. `ContractViolation`/`ContractMismatch` 두 기존 타입명은 target 이 검토·언급만 할 뿐 리네임하지 않기로 명시했고, 실측으로도 각 이름이 자기 파일에만 국한돼 있어 동명이의 충돌이 없음을 확인했다. 6개 관점 전부에서 CRITICAL/WARNING 사유를 찾지 못했다.

## 위험도

NONE
