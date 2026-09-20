# Cross-Spec 일관성 검토 — `spec/2-navigation` (impl-prep: rotate lost-update 수정)

## 배경 정리 (검토 전제)

이번 `--impl-prep` 대상은 `spec/2-navigation` 전체이지만, 실제 착수 작업은
`plan/in-progress/rotate-lost-update.md` (developer, `spec_impact: none`) 다. 직전에 같은 문제를
계약(신규 409 `INTEGRATION_ROTATE_CONFLICT`)으로 풀려던 draft(`plan/complete/spec-draft-rotate-conflict.md`)는
`review/consistency/2026/09/20/16_43_05` 의 `--spec` 검토에서 **BLOCK: YES** 로 이미 반증되어 철회됐고,
현재 채택안은 **spec 문서를 전혀 바꾸지 않고** `IntegrationsService.rotate()` 내부에서 "외부 호출은 락 밖,
락 안에서 재읽기 후 머지"로 코드만 고치는 것이다. 따라서 이번 cross-spec 검토의 초점은 "새 draft 문구가
다른 영역과 충돌하는가"가 아니라 **"spec 변경 없이 진행해도 되는가 — 즉 planned 구현이 `spec/2-navigation`
및 타 영역이 이미 선언한 계약·RBAC·데이터 모델·동시성 관례와 실제로 어긋나지 않는가"** 다.

## 점검 결과

### 1. API 계약 — 충돌 없음

`spec/2-navigation/4-integration.md` §9.2 rotate 행(`POST /api/integrations/:id/rotate`)은
"내부적으로 테스트 → 성공 시만 커밋"만 서술하고 동시성 결과는 언급하지 않는다. §3 상세 화면 표의
"Rotate credentials (비OAuth)" 행도 "실패 시 기존 자격 증명 유지"만 적는다. 채택안은 성공 응답
포맷(200)·실패 시 원상 유지 원칙을 그대로 유지하고 새 에러 코드를 도입하지 않으므로, 이 두 서술과
어긋나지 않는다. `spec/` 전체에 `INTEGRATION_ROTATE_CONFLICT` grep 0건(철회된 draft 문서 두 개
제외)임을 재확인했다 — 이전 반증 이후 잔여 문구가 spec 에 남아있지 않다.

### 2. 데이터 모델 — 충돌 없음

`spec/1-data-model.md §2.10 Integration`에는 낙관적 잠금 컬럼(`@VersionColumn` 류)이 없고
`last_rotated_at`/`updated_at`만 있다. 채택안은 새 컬럼·마이그레이션을 요구하지 않으며(비관적 행 잠금 +
재읽기), 이는 현재 데이터 모델 선언과 정합한다. 철회된 draft 가 우려했던 "`updated_at` 조건부 update"
술어(→ `logUsage` 의 동시 update 로 인한 거짓 충돌 위험)도 이번 안에는 등장하지 않는다.

### 3. 동시성 패턴 — 오히려 기존 cross-spec 관례를 강화

이 저장소는 "외부 호출은 락 밖, 락 안에서 재읽기 후 머지 + 부분 update" 패턴을 이미 여러 영역에서
독립적으로 채택해 spec 에 박아 두었다:

- `spec/data-flow/5-integration.md` 100~104행 — 같은 모듈(Integration)의 OAuth reauthorize/request_scopes
  콜백이 `SELECT integration FOR UPDATE (pessimistic_write — 동시 callback lost-update 차단)` 뒤 UPDATE.
- `spec/2-navigation/2-trigger-list.md` 200~230행 — `trigger.config` JSONB 에 대해 advisory lock
  (`pg_advisory_xact_lock`) 안에서 재읽기·부분 머지, "외부 provider 호출은 락 밖" 명시.
- `spec/5-system/1-auth.md` 216행 — WebAuthn counter 검증에 `SELECT ... FOR UPDATE`.
- `spec/data-flow/11-workflow.md` 51행, `spec/data-flow/12-workspace.md` 188행 — 삭제·버전 조회에
  `pessimistic_write`.

plan(`rotate-lost-update.md`)이 명시적으로 인용하는 선례(CONC H-3, `integration-oauth.service.ts`)는 바로
첫 항목이며, **같은 모듈 안의 같은 엔티티**에 이미 spec 문서(`data-flow/5-integration.md`)로 박제된
패턴이다. 채택안이 그 패턴을 rotate 경로에도 적용하는 것은 새 규칙을 만드는 게 아니라 이미 spec 에
있는 규칙을 rotate 에도 일관되게 적용하는 것 — cross-spec 충돌이 아니라 오히려 기존 산개된 관례를
정합시키는 방향이다.

### 4. RBAC — 충돌 없음, race 를 닫는 방향

`spec/2-navigation/4-integration.md` §8 권한 규칙 표는 `Rotate: 본인 것만(Personal) / Admin 이상
(Organization)`으로 이미 선언돼 있다. plan §D 가 제안하는 "재읽기 시점에 권한도 다시 확인"은 이 표의
규칙을 **바꾸지 않고**, "연결 테스트가 도는 수 초 동안 scope 가 personal→organization 으로 바뀌면 비관리자
요청이 옛 스냅샷 권한으로 통과한다"는 race 를 닫는 것이다. `spec/2-navigation/9-user-profile.md` §4.2
(역할·권한 매트릭스, RBAC SoT)에는 rotate 관련 서술이 없음을 확인했다(grep 0건) — 중복 정의로 인한 두
소스 간 충돌 가능성도 없다.

### 5. 상태 전이 — 충돌 없음

§6 상태 전이표(`expired/error → connected`, rotate 성공 경로)는 그대로 유지된다. 채택안은 커밋 시점의
merge base 만 바꾸고 성공/실패 판정·상태 전이 자체는 바꾸지 않는다.

### 6. 계층 책임 — 충돌 없음

변경은 `IntegrationsService.rotate()` 단일 backend 서비스 메서드 내부에 국한되고, frontmatter `code:`
목록(`codebase/backend/src/modules/integrations/**`)이 이미 이 파일을 포괄한다. frontend·다른 모듈과의
경계 재조정은 없다.

## 발견사항

- **[INFO]** `data-flow/5-integration.md` 의 rotate 흐름 서술이 잠금 스텝을 언급하지 않아, 인접한
  OAuth reauthorize 흐름과 비대칭
  - target 위치: (구현 대상) `spec/2-navigation/4-integration.md` §9.2 rotate 행 — 문구 변경 없음(계획대로)
  - 충돌 대상: `spec/data-flow/5-integration.md` 65~67행(rotate 산문) vs 같은 파일 100~104행(OAuth
    reauthorize/request_scopes 시퀀스 다이어그램의 `SELECT integration FOR UPDATE` 명시)
  - 상세: 구현이 완료되면 rotate 도 같은 모듈의 pessimistic row lock 패턴을 쓰게 되는데,
    `data-flow/5-integration.md` 의 rotate 산문(65~67행)은 "연결 테스트 통과 시 credentials merge +
    last_rotated_at 갱신 + connected 복귀"만 적어 잠금 여부에 대해 침묵한다. 인접한 OAuth 콜백 시퀀스는
    같은 문서에서 `SELECT ... FOR UPDATE` 를 명시적으로 그린다. 모순되는 진술은 아니다(침묵이지 부정이
    아니다) — 그래서 CRITICAL/WARNING 은 아니다. 다만 "이 문서가 이 모듈의 동시성 메커니즘을 설명하는
    자리"라는 점에서 정보가 비대칭적이다.
  - 제안: 이 PR 의 `spec_impact: none` 판단(외부 계약 불변)은 유지하되, 여력이 있다면 developer PR 이
    `data-flow/5-integration.md` 65~67행 근처에 한 줄("rotate 도 커밋 직전 `SELECT integration FOR
    UPDATE` 로 재읽기 후 머지 — CONC H-3 와 동일 메커니즘")을 덧붙이는 것을 권장한다. 이는 §자기-반증형
    소정정 조건에 해당하지 않는 통상적 문서 갱신이므로, 필요하다고 판단되면 별도 project-planner 턴 없이
    스킵해도 이번 코드 변경의 정합성 자체에는 영향이 없다(비차단).

## 요약

`spec/2-navigation` 스코프에서 착수하려는 실제 작업(`rotate-lost-update.md`)은 spec 문서를 바꾸지 않는
코드 전용 수정이며, 그 근거인 "외부 호출은 락 밖 · 락 안에서 재읽기 후 부분 update"라는 동시성 처방은
같은 모듈(Integration OAuth 콜백, `data-flow/5-integration.md`)과 인접 도메인(Trigger config, Workflow
버전, WebAuthn, Workspace 삭제)에 이미 spec 으로 박제된 패턴과 정확히 일치한다. API 계약(§9.2)·RBAC(§8)·
상태 전이(§6)·데이터 모델(§2.10)의 기존 선언 중 어느 것도 이 구현으로 거짓이 되지 않으며, 직전에
반증되어 철회된 409 계약안의 잔여 문구도 spec 에 남아 있지 않다. 유일한 발견은 `data-flow/5-integration.md`
가 rotate 의 잠금 메커니즘을 명시하지 않는 비대칭(INFO, 비차단)뿐이다.

## 위험도

LOW
