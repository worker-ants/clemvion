# 변경 범위(Scope) 리뷰 결과

## 분석 대상 개요

변경 파일 총 44개 (리뷰 산출물 + spec 변경):

- **review/consistency/2026/06/28/14_49_11/**: webchat-polish-batch 의 `--impl-done` 1차 consistency 검토 결과 (5개 파일)
- **review/consistency/2026/06/28/15_02_09/**: webchat-polish-batch 의 `--impl-done` 2차 consistency 검토 결과 재실행 (7개 파일)
- **review/consistency/2026/06/28/15_41_51/**: competent-mirzakhani(webhook WH-NF-02) spec의 `--impl-done` consistency 검토 결과 (7개 파일)
- **review/consistency/2026/06/28/16_05_14/**: 위 동일 워크트리 2차 검토 (8개 파일)
- **review/consistency/2026/06/28/16_48_46/**: autorefresh-attention 구현 착수 전 `--impl-prep` consistency 검토 결과 (7개 파일)
- **spec 실제 변경** (10개 파일): `spec/4-nodes/`, `spec/5-system/`, `spec/7-channel-web-chat/`, `spec/data-flow/`

---

## 발견사항

### [INFO] review/ 산출물에 다른 워크트리 경로 하드코딩 포함
- 위치: `review/consistency/2026/06/28/15_02_09/_retry_state.json`, `15_41_51/_retry_state.json`, `16_05_14/_retry_state.json` 내 `session_dir`, `prompt_file`, `output_file` 경로
- 상세: `_retry_state.json` 파일들이 `webchat-polish-batch-99e2ed`·`competent-mirzakhani-34a96a` 등 다른 워크트리의 절대경로를 포함한다. 이는 해당 워크트리에서 생성된 산출물을 현재 워크트리로 복사·커밋할 때 발생하는 경로 잔재다. review/ 산출물은 CLAUDE.md가 정의한 `review/` 디렉토리에 올바르게 저장됐고 _retry_state.json 은 내부 상태 파일로 기능에 영향 없으나, 다른 워크트리를 식별하는 절대경로가 저장소에 남는다. 충돌 없음.
- 제안: 기능·검증 영향 없음. 현행 유지 가능.

### [INFO] review/consistency/ 산출물이 다수 포함 — 의도된 커밋 범위
- 위치: `review/consistency/2026/06/28/{14_49_11,15_02_09,15_41_51,16_05_14,16_48_46}/` 총 34개 파일
- 상세: 이번 변경은 단일 autorefresh-attention 구현이 아니라 **세 개의 서로 다른 작업**(webchat-polish-batch, competent-mirzakhani webhook, autorefresh-attention 구현 준비)의 consistency 리뷰 산출물을 동시에 커밋한다. 이는 CLAUDE.md 규약(리뷰 산출물은 동일 PR 에 포함)에 따른 것이지만, `15_41_51`·`16_05_14` 세션은 `competent-mirzakhani-34a96a` 워크트리 산출물이고 현재 worktree(`autorefresh-attention-65b750`)와 무관한 PR 의 산출물로 보인다. 범위 관점에서 이 두 세션이 현재 PR 에 포함된 이유를 확인해야 한다.
- 제안: `review/consistency/2026/06/28/15_41_51/`·`16_05_14/`가 현재 PR scope(autorefresh-attention)에 속하는지 확인. 다른 PR 소속이라면 해당 PR 에서 커밋하는 것이 범위 정합하다. 단, `review/` 는 gitignored 가 아니고 산출물 커밋이 규약이므로 누락된 산출물을 이 PR 에서 묶어 올리는 결정 자체는 가능하다.

### [INFO] spec 변경이 두 작업의 산출물을 혼합
- 위치: 파일 36~44 — `spec/4-nodes/7-trigger/1-manual-trigger.md`, `spec/5-system/12-webhook.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`, `spec/7-channel-web-chat/1-widget-app.md`, `spec/7-channel-web-chat/2-sdk.md`, `spec/7-channel-web-chat/4-security.md`, `spec/7-channel-web-chat/5-admin-console.md`, `spec/data-flow/10-triggers.md`
- 상세: spec 변경 9개 파일이 두 가지 다른 작업을 혼합한다 — (1) webchat-polish-batch 의 spec 폴리시(`1-widget-app`, `2-sdk`, `5-admin-console`), (2) webhook WH-NF-02 구현 완료 반영(`12-webhook`, `2-api-convention`, `3-error-handling`, `data-flow/10-triggers`, `7-channel-web-chat/4-security`). `1-manual-trigger.md` 는 webhook 400 에러 봉투 정합화(`errors` → `details`) 수정이다. 이는 단일 커밋에 묶이기는 했으나 각 변경은 해당 plan 에 명시된 범위 내이고, 변경 간 의도적 충돌이 없다.
- 제안: scope 위반이 아님. 다만 PR 설명에서 포함된 두 작업이 명시되어 있는지 확인 권장.

---

## 요약

이번 변경은 크게 두 그룹으로 구성된다. (1) webchat-polish-batch 와 webhook WH-NF-02 두 작업에 대한 consistency review 산출물(`review/consistency/`) 35개, (2) 해당 작업들의 실제 spec 수정 9개. spec 변경은 각각의 plan에 명시된 항목과 1:1 대응하며, 의도하지 않은 리팩토링·기능 추가·무관 파일 수정이 없다. 포맷팅·주석·임포트·설정 변경도 실질 변경과 분리 없이 섞인 사례가 없다. 유일한 관찰 사항은 `_retry_state.json` 파일에 남은 타 워크트리 절대경로(기능 영향 없음)와, `15_41_51`·`16_05_14` 리뷰 세션이 현재 PR(`autorefresh-attention`) 이 아닌 다른 워크트리(`competent-mirzakhani`) 작업 산출물이라는 점이다 — 후자는 CLAUDE.md 리뷰 산출물 커밋 규약에 따라 한 PR 에 묶는 것이 허용되나, 의도를 명확히 할 필요가 있다.

## 위험도

NONE
