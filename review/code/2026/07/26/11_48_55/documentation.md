# 문서화(Documentation) Review

리뷰 대상: 선형 경로 외부 cancel 전파 결함 수정 (`assertExecutionNotCancelled` 신설) — 5개 파일.

## 발견사항

- **[WARNING]** e2e 스펙 파일 상단 JSDoc 이 이번 변경으로 stale 해졌다 — "기전 미확인" 경고가 같은 커밋에서 반증됐다.
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:26-44` (특히 `:38-44`) — 해당 블록은 이번 diff 에 포함되지 않은 기존 주석(파일 상단 `## ⚠ 기전은 미확인 — 이 파일은 **결과만** 주장한다` 섹션).
  - 상세: 이 헤더 JSDoc 은 "**어느 코드가 이 속성을 보장하는지는 아직 특정되지 않았고, 타이밍 우연 가능성을 배제하지 못한다.** 엔진 단위 테스트로 … 결정적으로 고정하는 것이 후속 과제다 (`plan/in-progress/node-cancellation-residual-signal-propagation.md`)" 라고 명시한다. 그런데 바로 이 PR 이 (1) `execution-engine.service.ts` 에 `assertExecutionNotCancelled` 를 신설해 기전 부재를 실제 결함으로 규명·수정했고(파일 2), (2) `execution-engine.service.spec.ts` 에 그 계약을 엔진 레벨 mock 으로 고정하는 신규 `describe` 를 추가했으며(파일 1, gate 4934-4970), (3) 참조된 plan 파일의 해당 체크리스트 항목을 `[x]` 로 완료 처리했다(파일 5, gate 73-89, "기전은 존재하지 않았다(진짜 결함)"). 즉 "후속 과제" 로 지목된 작업이 같은 커밋에서 끝났는데, 이 사실을 알리는 유일한 장소(e2e 파일 헤더)만 갱신되지 않아 향후 이 파일을 읽는 사람에게 "기전은 여전히 미확인" 이라는 반증된 정보를 그대로 전달한다. 타이밍 우연 가능성에 대한 우려("배제하지 못한다")도 이제는 근거가 사라졌다(엔진 단위 테스트가 결정적으로 고정).
  - 제안: 헤더 JSDoc 을 "기전이 부재했음이 확인되어 `assertExecutionNotCancelled`(§2.3/§5.1)로 수정됐고, 엔진 단위 테스트(`execution-engine.service.spec.ts` "선형 경로 외부 cancel 전파" describe)가 계약을 결정적으로 고정한다" 로 갱신. "## ⚠ 기전은 미확인" 제목 자체도 더 이상 사실이 아니므로 정정 필요.

- **[WARNING]** 이번 변경(부수효과 지속 버그 수정)에 대한 `CHANGELOG.md` 항목이 없다 — 저장소 관행과 불일치.
  - 위치: `CHANGELOG.md` (이번 diff 에 포함되지 않음 — 신규 항목 부재 자체가 지적 대상).
  - 상세: `CHANGELOG.md` 는 이 저장소에서 활발히 유지되는 "Unreleased — …" 항목 목록이며, 특히 "사용자 가시 버그 수정" 라벨로 유사한 심각도의 결함(예: 웹채팅 종료된 위젯 부활 버그, idle reaper 등)을 매번 기록해 왔다. 이번 결함은 그 기준을 넘는다 — Stop 버튼을 눌러도 실행이 CANCELLED 로 라벨만 바뀔 뿐 "돌고 있는 순회 루프에 아무 신호도 보내지 않아" 하류 노드가 계속 dispatch 되고, 그 결과 **취소 후에도 이메일 발송·HTTP POST·DB 쓰기 등 부수효과가 계속 발생**했다(파일 2 신규 JSDoc, 파일 5 완료 기록에 명시). 이는 데이터/부작용에 실질적 영향을 주는 프로덕션 결함이며, 그 심각도·성격이 기존 CHANGELOG 항목들과 동일한 급이다.
  - 제안: `## Unreleased — Stop 이후 부수효과 지속 fix (선형 경로 cancel 전파)` 형태의 항목을 추가해, 결함(부수효과 지속)·원인(루프가 상태를 재조회하지 않음)·수정(`assertExecutionNotCancelled` 노드 경계 3곳)을 기존 항목들의 서술 패턴으로 기록.

- **[WARNING]** SoT 컨벤션 문서 `spec/conventions/node-cancellation.md` 가 새 메커니즘을 반영하지 않고, 갱신을 위한 위임 기록도 없다 (같은 plan 파일의 자매 항목과 비대칭).
  - 위치: `plan/in-progress/node-cancellation-residual-signal-propagation.md:73-89` (신규 체크리스트 항목, gate 번호 기준) — cross-ref `spec/conventions/node-cancellation.md` §2.3(gate 60)/§5.1(gate 109)/§6 표(gate 134, 140) (이번 diff 대상 아님, developer 는 `spec/` read-only).
  - 상세: 신규 체크리스트 항목(gate 80-81)은 스스로 "`spec/conventions/node-cancellation.md:140` 의 'dispatch 사전 abort 체크 ✓' 와 `:60` 의 'stop 이 실행을 중단' 은 **선형 경로에서 사실이 아니었다**" 라고 명시한다. 그런데 그 spec 문서의 §2.3(gate 60, "REST API `POST /executions/:id/stop` 가 실행을 중단")·§5.1(gate 107-109, `AbortError`→`cancelled` 분류 서술)·§6 표(gate 140, "dispatch 사전 abort 체크")는 여전히 **노드-레벨 `context.abortSignal` 사전 체크**만 서술할 뿐, 이번에 추가된 **Execution-레벨 DB 재조회 가드(`assertExecutionNotCancelled`, 노드 경계 3곳)** 는 어디에도 등장하지 않는다. `code:` frontmatter 목록에도 그 로직이 실제로 위치한 `execution-engine.service.ts` 가 빠져 있다. 같은 plan 파일 안의 자매 항목(chat-channel: gate 45-48 "spec §6 표의 해당 행 처분은 spec/ 권한 밖이라 위임했고 … 이행 완료", MakeShop/Cafe24: 진행 기록 §"§6 표 두 행 갱신은 spec/ 권한 밖이라 planner 위임 … 이행 완료")는 spec 갱신을 명시적으로 project-planner 에 위임하고 완료를 추적하는데, 이번 "선형 경로 cancel 전파" 항목만 그런 위임 기록 없이 `[x]` 로 종결됐다. developer 는 `spec/` 을 쓸 수 없으므로 정당한 판단이지만(CLAUDE.md §Skill 체계), 이 특정 갭에 대한 후속 위임 문서가 누락되면 spec 이 계속 부정확한 상태로 남을 위험이 있다.
  - 제안: 이 항목도 sibling 항목들과 동일하게 "spec §2.3/§5.1/§6 갱신은 spec/ 권한 밖이라 project-planner 위임" 을 명시하고, 필요 시 `spec-update-node-cancellation-linear-dispatch-guard.md` 류의 위임 초안을 신설. `code:` frontmatter 에 `execution-engine.service.ts` 추가도 함께 요청.

- **[INFO]** 긍정적으로 짚을 점 — 코드 레벨 문서화 품질은 우수하다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (신규 `assertExecutionNotCancelled` JSDoc, gate 7772-7807) · `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:306-319`(신규 "관측 시점 고정" 주석) · `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4934-4970`(신규 describe 상단 주석) · `codebase/backend/src/modules/execution-engine/workflow-errors.ts:315-320`(생성자 파라미터화 근거 JSDoc).
  - 상세: 네 곳 모두 "왜 이 코드가 필요한가"(반증된 대안 후보 2개 명시) · "왜 DB 를 다시 읽는가"(비용·대안 불가 이유) · "관측 시점을 왜 이렇게 고정했는가"(2026-07-26 실측: 가드 없이도 구 e2e 가 통과했다는 구체적 반례)를 근거와 함께 기록해, 이 문서 리뷰 관점에서 모범 사례에 해당한다. 위 WARNING 3건은 이 우수한 개별 주석들이 파일 경계를 넘어 서로(그리고 상위 SoT 문서·CHANGELOG) 와 동기화되지 못한 데서 발생한다.

## 요약

코드 레벨(신규 `assertExecutionNotCancelled` JSDoc, 신규 유닛테스트 describe, e2e 신규 주석, 에러 클래스 JSDoc)의 문서화 품질 자체는 이 저장소 평균을 상회할 정도로 충실하다 — 근거·반증된 대안·비용까지 기록했다. 문제는 그 개별 파일 내부 주석이 아니라 **파일 경계를 넘는 동기화**다: (1) e2e 파일의 헤더 JSDoc 이 "기전 미확인 + 후속 과제" 를 여전히 주장하는데 같은 커밋이 그 후속 과제를 완료해 반증했고, (2) 부수효과가 지속되던 실사용자 영향 결함임에도 이 저장소의 확립된 CHANGELOG 관행을 따르지 않았으며, (3) SoT 컨벤션 문서(`node-cancellation.md`)가 새 메커니즘을 반영하지 못한 채로 남아 있는데 그 spec-위임 기록조차 같은 plan 파일의 자매 항목과 달리 누락됐다. 셋 다 머지를 막을 결함은 아니지만, 향후 엔지니어가 "기전이 아직 규명 안 됐다" 고 오인해 같은 조사를 반복하거나, 이 심각도의 결함이 변경 이력에서 누락되거나, spec 문서가 실제 구현과 계속 어긋난 채로 방치될 실질적 위험이 있다.

## 위험도

MEDIUM
