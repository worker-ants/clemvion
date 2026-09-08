# Rationale 연속성 검토 — `plan/in-progress/spec-draft-followups-batch-a.md`

## 발견사항

- **[CRITICAL] A-5 변경안(b) 신규 Rationale 이 "select: false 미사용" 을 저장소 전체로 과잉일반화 — 같은 문서 안의 반례로 즉시 반증됨**
  - target 위치: `plan/in-progress/spec-draft-followups-batch-a.md` A-5 "변경안 (b) — `1-data-model.md ## Rationale` 에 결정 근거 승격" 표 1행:
    > "컬럼 `select: false` | **기각 — fail-silent.** 그 컬럼을 읽는 내부 경로가 조용히 `undefined` 를 받는다. 실제로 이 저장소는 `select: false` 도 `@Exclude()` 도 쓰지 않는다(2026-09-06 전수 확인)"
  - 과거 결정 출처: 이 문장이 편입될 바로 그 문서 `spec/1-data-model.md` 자신 — §2.19(Notification) 행 (`1-data-model.md:730`) *"background_run_id | UUID? | … REST 미노출(`select:false`)"*, 그리고 그 설계의 근거인 `spec/data-flow/8-notifications.md` `### 딥링크와 attribution 을 별도 컬럼으로 분리 (V107 — background_run_id)` Rationale.
  - 상세: 실제로 `codebase/backend/src/modules/notifications/entities/notification.entity.ts:56-62` 는 `backgroundRunId` 컬럼에 `select: false` 를 **쓰고 있다** (`@Column({ name: 'background_run_id', …, select: false })`). 즉 "이 저장소는 select: false 를 쓰지 않는다"는 검증 가능한 반례로 즉시 반증된다. target 이 인용한 실제 출처(`user-entity-exposure.spec.ts:24-26`, `user-secret-absence.ts:20`)의 원문은 *"**민감 7컬럼에** `select: false` 0건"* 으로 **User 엔티티 범위에 정확히 좁혀** 적혀 있는데, target 초안이 이를 "이 저장소는" 이라는 저장소 전체 진술로 **범위를 넓혀** 옮겨 적었다. `Notification.background_run_id` 가 select:false 로 안전한 이유는 그 컬럼의 유일한 내부 소비 경로(`findByBackgroundRun`)가 **WHERE 절만 쓰고 값 자체를 읽지 않기** 때문이고, `User` 의 7컬럼이 위험한 이유는 `UsersService.findById/findByEmail` 의 19개 호출부가 **값을 직접 소비**(`comparePassword` 등)하기 때문이다 — 두 결정은 서로 모순이 아니라 "컬럼별 소비 패턴에 따라 판단한다" 는 **더 좁고 정확한 원칙**의 두 사례다. target 의 과잉일반화 문장은 이 원칙을 지우고 반증 가능한 거짓 진술로 대체한다. 이는 SoT 문서의 `## Rationale` 에 영구 기록될 문장이며, 같은 문서 730행과 정면으로 모순돼 다음 독자가 어느 쪽을 믿어야 할지 알 수 없게 만든다.
  - 제안: 문장을 실제 근거(`user-secret-absence.ts`/`user-entity-exposure.spec.ts`)가 쓴 범위 그대로 좁혀 *"`User` 민감 7컬럼에 `select: false` 0건(2026-09-06 실측)"* 으로 정정한다. 필요하면 `Notification.background_run_id` 반례를 명시적으로 배제하는 경계 문장을 덧붙인다 — 이 저장소가 이미 `secret-store.md` 곳곳에서 쓰는 관용구("이 문단을 …의 선례로 인용하려면 조건 X 를 만족해야 한다")를 재사용해 *"select: false 채택 여부는 컬럼별 소비 패턴(WHERE-only vs 값 직접 소비)으로 판단하며, `Notification.background_run_id` 는 전자라 `select:false` 가 유효하다"* 정도로 갈라 적으면 반증도 피하고 기존 결정(Notification)과의 정합도 함께 선다.

- **[INFO] A-2-1 의 R-2 앵커 변경이 인입 링크 전수 갱신을 전제로 하는데, 실제 인입처가 target 이 열거한 것보다 하나 더 있을 수 있다**
  - target 위치: A-2-1 "변경안" 및 체크리스트 `A-2 … (앵커 인입 링크 전수 갱신)`
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` R-CC-10 (`#r-2-webhook-hmac-secret-입력-vs-rotate-분리`를 인용)
  - 상세: target 은 R-CC-10 한 곳만 동반 갱신 대상으로 명시했다. 그러나 실제 리포지토리에는 `spec/2-navigation/2-trigger-list.md` 자기 자신의 §2.3.1 `inboundSigning` 행(103행 부근)도 `[R-CC-10]` 을 인용하고 있고, R-2 자체를 가리키는 인입 링크는 R-CC-10 한 곳으로 실측된다(제목 변경 시 slug 는 `#r-2-webhook-hmac-secret-입력-vs-rotate-분리` → `#r-2-webhook-hmac-secret-입력-vs-rotate-분리-v1--v11--폐기` 로 바뀐다). target 이 스스로 명시한 `grep -rn "r-2-webhook-hmac-secret" spec` 검증 절차는 올바른 방향이므로 실질 결함은 아니지만, 실행 시점에 R-CC-10 외에 인용처가 없는지 그 grep 결과를 그대로 커밋 diff 에 남겨두는 것을 권한다(0건 초과 시 즉시 드러나도록).
  - 제안: 체크리스트 항목에 "grep 결과를 PR 본문/plan 에 실측 기록" 을 덧붙인다. 실제 처분을 바꾸지는 않는다.

## 요약

target 배치의 다섯 항목(A-1~A-5) 대부분은 과거 Rationale 을 존중하는 방식으로 잘 설계돼 있다 — 특히 A-2-1(R-2 를 삭제 대신 취소선+정정 콜아웃으로 보존, R-CC-10 인용문 동시 갱신), A-2-2(자매 문서 `3-schedule.md` 선례 주장을 스스로 실측 검증해 오류를 찾아 정정), A-3(기존에 명문화되지 않았던 두 관례를 택일 기준으로 승격하되 기각 이력을 지어내지 않음), A-4(최근 커밋 #1289 의 "두 검증자" 서술을 개수 대신 원칙으로 바꾸며 그 이유까지 문서화)는 모두 과거 결정을 뒤집지 않거나, 뒤집을 때 그 근거를 명시하는 이 저장소의 관례(Rationale 은 실제 이력이어야 하고, 소급 근거 부여를 하지 않는다)를 잘 따른다. 다만 A-5 가 `1-data-model.md ## Rationale` 에 새로 쓰려는 "이 저장소는 `select: false` 를 쓰지 않는다"는 전수-확인 문장은, 정작 그 문장이 실릴 바로 그 문서 안에 이미 존재하는 `Notification.background_run_id`(§2.19, V107) 의 `select:false` 사용 사례와 정면 충돌하며, 실제 근거 코드(`user-entity-exposure.spec.ts`)가 "민감 7컬럼에 한정"해 적어 둔 범위를 검증 없이 넓힌 결과다 — SoT 에 반증 가능한 거짓 불변식을 새로 새기는 것이라 정정이 필요하다.

## 위험도

MEDIUM
