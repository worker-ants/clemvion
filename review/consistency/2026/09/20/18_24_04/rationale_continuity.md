# Rationale 연속성 검토 — `spec/2-navigation` (rotate lost-update, --impl-done)

## 스코프 정정

프롬프트 번들의 `spec/2-navigation` 파일 16개 중 대부분(및 실제 `git diff origin/main...HEAD`)이 예산 절단으로
생략되어 있었다. 판정을 위해 다음을 절대경로/`git -C`로 직접 열었다:

- `git diff origin/main...HEAD --stat` / `-- codebase/backend/src/modules/integrations/integrations.service.ts`
- `spec/2-navigation/4-integration.md` (§8 권한 규칙, §9 API, `## Rationale` 전문 — advisory lock 기각 항 포함)
- `spec/data-flow/5-integration.md` (rotate·reauthorize 서술)
- `plan/complete/rotate-lost-update.md`, `plan/complete/spec-draft-rotate-conflict.md`(superseded),
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 갱신분)
- `review/consistency/2026/09/20/16_58_56/rationale_continuity.md`(전회 `--impl-prep` 리뷰),
  `review/code/2026/09/20/18_09_24/RESOLUTION.md`(2라운드 코드 리뷰 처분)
- `codebase/backend/src/modules/integrations/integration-oauth.service.ts`(인용된 `CONC H-3` 실코드)

이 PR 의 실질 target 은 `spec/2-navigation` 디렉터리 자체가 아니라, 그 스코프 코드(`4-integration.md` 의
`code:` 프론트매터가 문 `codebase/backend/src/modules/integrations/**`) 안에서 구현된
`IntegrationsService.rotate()` 의 lost-update 수정이 같은 파일의 `## Rationale` 이 이미 내린 결정들과
정합하는지다. `spec/2-navigation` 자체의 diff 는 0개 파일이 맞다 — spec 은 바뀌지 않았고, 코드 diff 3파일/581줄이
전부다.

## 발견사항

### 정합 확인 (위반 없음 — 이하는 CRITICAL/WARNING 아님, 근거로 남긴다)

1. **advisory lock 기각(§`BullMQ cafe24-token-refresh 큐`)의 재도입 아님 — 구분이 코드 주석에 명시됨**
   - target 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` 트랜잭션 블록 주석(약 1160행대)
   - 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` → "BullMQ `cafe24-token-refresh` 큐 — 멀티 인스턴스
     race 해소" § "검토 후 배제한 대안" — *"PostgreSQL advisory lock(`pg_advisory_xact_lock`): lock 보유 중 HTTP 요청을
     transaction 안에 묶어야 해 DB 커넥션 점유 시간이 늘고 …"*
   - 상세: 새 `rotate()` 는 `dataSource.transaction` + `lock: { mode: 'pessimistic_write' }` (row-level, advisory 아님)를
     쓰고, **연결 테스트(HTTP)는 트랜잭션 밖**에서 이미 끝난 뒤 트랜잭션에 진입한다 — 기각 사유("락 보유 중 HTTP 요청을
     트랜잭션에 묶는다")가 애초에 적용되지 않는 다른 설계다. 전회 `--impl-prep` 리뷰(`16_58_56`)가 WARNING 으로
     "이 구분을 명시하지 않으면 다음 리뷰어가 재도입으로 오인할 위험"을 지적했고, 실제 diff 에는 그 구분이 코드 주석에
     정확히 반영되어 있다: *"`4-integration.md` Rationale 이 기각한 advisory lock 의 재도입이 아니다 — 그 기각 사유는
     …인데, 여기서는 연결 테스트가 트랜잭션 **밖**이고 …"*. `plan/complete/rotate-lost-update.md` §B (W1)에도 동일 문장이 있다.
   - 결론: 기각된 대안의 재도입이 아니며, 그 사실이 코드·plan 양쪽에 명시적으로 대조되어 있다. 조치 불요.

2. **락 도입 자체는 인접 선례(`CONC H-3`, `trigger-config-lost-update.md`)와 형태가 일치**
   - 과거 결정 출처: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` 의 `CONC H-3`
     (2026-05-16) 주석 — 재인증 콜백에서 provider 토큰 교환 **후** `pessimistic_write` 로 행을 재읽어 쓰는 동일 패턴.
     `plan/complete/trigger-config-lost-update.md` 가 이 형태를 "외부 호출은 락 밖, 락 안에서 재읽기"로 일반화한 선례.
   - 상세: `git -C` 로 `integration-oauth.service.ts:723-731` 을 직접 확인 — 인용이 정확하다(날조 아님). 락 대기 상한을
     두지 않는 결정도 `CONC H-3` 과 동일 리스크 등급으로 plan 에 명시(`INFO 2`).
   - 결론: 위반 없음.

3. **"409 충돌" 대안을 검토 후 명시적으로 철회 — 새 Rationale 대신 코드로 닫는 결정을 문서화**
   - target 위치: `plan/complete/spec-draft-rotate-conflict.md` (frontmatter `status: superseded`)
   - 상세: 이 PR 은 처음 `INTEGRATION_ROTATE_CONFLICT`(409) 신설을 시도했다가 `/consistency-check --spec`
     (`review/consistency/2026/09/20/16_43_05`, BLOCK: YES)이 (a) 대상 spec 이 `status: implemented` 라 미구현
     계약을 얹으면 하향이 필요하고, (b) 같은 형태를 이미 락으로 닫은 선례(`trigger-config-lost-update.md`,
     `CONC H-3`)를 검토 없이 건너뛰었으며, (c) "범용 conflict 코드 없음"이 과잉 일반화였음(`RESOURCE_CONFLICT`
     기본값·`WORKFLOW_VERSION_CONFLICT` 선례 존재)을 반증해 draft 를 `superseded` 로 접었다. 결정 번복(계약 추가 →
     철회)이 발생했지만, 번복 자체가 이유와 함께 별도 문서(superseded plan)로 남아 있고 dangling 참조가 없다.
   - 결론: "결정의 무근거 번복"에 해당하지 않는다 — 오히려 반대 방향(무근거 신설을 사전에 차단)의 모범 사례.

### INFO — 이미 등재·유예된 후속 갭 (재확인, 신규 아님)

- **[INFO]** `spec/data-flow/5-integration.md` 의 rotate 서술에 잠금 메커니즘이 아직 없음
  - target 위치: `spec/data-flow/5-integration.md` L65-67 (rotate 흐름 서술)
  - 과거 결정 출처: 같은 문서의 형제 흐름 — reauthorize(L101) "`SELECT integration FOR UPDATE
    (pessimistic_write — 동시 callback lost-update 차단)`"
  - 상세: reauthorize 는 락 메커니즘을 명시하는데 rotate 는 여전히 락 언급 없이 "연결 테스트 통과 시 credentials
    merge + `last_rotated_at` 갱신"으로만 서술되어 있다 — 실측으로 확인됨(코드는 이제 락을 쓰지만 문서가 뒤처짐).
    이것은 새 Rationale 없이 결정을 뒤집은 사례가 아니라, **코드가 옳고 spec 서술만 지연**된 spec-drift 다.
    이미 `--impl-prep`(`16_58_56` cross_spec INFO 1)과 `/ai-review`(`18_09_24` SPEC-DRIFT 1) 두 차례 포착되어
    "비차단·`spec_impact: none` 유지 가능"으로 처분됐고, `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 planner 후속으로 등재되어 있다(2026-09-20). `spec/` 쓰기는 developer 권한 밖이라 이 PR 이 직접 고치지 않는
    것은 규약대로다.
  - 제안: 조치 불요(이미 트래커에 있음) — 다음 planner 턴에서 한 줄(rotate 도 `pessimistic_write` 재읽기 사용)
    추가 권고.

- **[INFO]** personal-scope 소유자 검증(§8 "본인 것만")이 `assertCanRotate` 에 없음 — 회귀 아님, 이미 등재
  - target 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `assertCanRotate()`
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` §8 권한 규칙 표 — "Rotate | 본인 것만 | Admin 이상"
  - 상세: `assertCanRotate` 는 organization-scope 의 admin 여부만 검사하고 personal-scope 의 소유자(본인) 검증은
    하지 않는다. `git show origin/main:...` 대조로 이 PR 이전부터 있던 갭임이 확인되어 회귀는 아니다.
    `/ai-review`(`18_09_24` requirement INFO 6)가 이미 포착해 트래커에 등재했고, "rotate 한 곳이 아니라 권한 모델
    전반(조회·수정·삭제)의 문제라 범위를 먼저 정해야 한다"는 처분이 명시되어 있다. 이번 rationale-continuity
    관점에서도 §8 원칙과의 괴리가 이 PR 이 새로 만든 것이 아니라 기존 상태의 재확인이라는 점에서 CRITICAL/WARNING
    승격 근거가 없다.
  - 제안: 조치 불요(이미 트래커에 있음, 별도 PR 범위).

## 요약

`spec/2-navigation` 델타는 0개 파일이지만, 그 스코프의 코드(`4-integration.md` 가 문 `integrations.service.ts`)에서
일어난 `rotate()` lost-update 수정을 같은 문서의 `## Rationale` 과 대조한 결과, 기각된 대안(advisory lock)의
재도입은 없으며 그 구분이 코드 주석·plan 양쪽에 명시적으로 기록되어 있다. 대안으로 검토했던 "409 충돌" 계약
신설은 `/consistency-check --spec` 반증을 거쳐 근거와 함께 철회(`superseded`)되어 무근거 번복이 아니다. 남은 두
갭(`spec/data-flow/5-integration.md` 문서 지연, personal-scope 소유자 검증 부재)은 모두 이 PR 이전부터 알려져
있거나(후자) 이미 두 차례 포착·유예된(전자) 항목으로, 이번 diff 가 새로 야기한 Rationale 위반이 아니다. 전체적으로
이 변경은 Rationale 연속성 관점에서 모범적으로 자기검증(선례 인용 정확성 확인, 기각 사유와의 명시적 대조, 반증된
대안의 문서화된 철회)을 거쳤다.

## 위험도

NONE
