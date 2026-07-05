# 정식 규약 준수 검토 — spec-draft-g1-withdraw-ws-start-gate.md

검토 모드: spec draft 검토 (--spec)
target: `plan/in-progress/spec-draft-g1-withdraw-ws-start-gate.md`

## 발견사항

- **[WARNING]** `## Rationale` 헤딩 누락 — `project-planner` SKILL 의 spec-draft 문서 구조 규약 미준수
  - target 위치: 문서 전체 (헤딩 목록: `## 배경 (G1 필요성 평가 결론)` → `## 결정` → `## 변경` → `## 체크리스트`)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §작업 워크플로 3번 — "`plan/in-progress/spec-draft-<name>.md` 에 변경안 작성. **본문 끝에 `## Rationale` 로 결정 근거 명시**." (같은 SKILL §Spec 문서 구조 3섹션 권장의 `spec-draft` 적용판)
  - 상세: target 은 `배경`/`결정` 절에 결정 근거(사실관계 검증·기각 근거)를 담고 있어 실질적으로 rationale 내용은 존재하지만, 명시적 `## Rationale` 헤딩으로 분리돼 있지 않다. 형제 문서 `plan/in-progress/spec-draft-concurrency-cap-pr2b.md`(`## Rationale` 말미 보유)·`plan/in-progress/spec-draft-dataflow-exec-seq-3way.md`(동일)는 이 규약을 준수해 일관된 선례를 이룬다. 반면 target 은 그 컨벤션에서 벗어난 유일한 예외.
  - 제안: 문서 끝(`## 체크리스트` 앞 또는 뒤)에 `## Rationale` 절을 신설해 "G1 을 왜 철회로 판단했는가"(§8.2/§4.2 REST-only 확정 근거, WS 시작 경로가 실제 gap 이 아닌 이유, engine §11 만 국소적으로 stale 했던 이유)를 그대로 옮기거나 요약 인용. 콘텐츠 자체는 이미 `배경` 절에 존재하므로 순수 구조 재배치로 해소 가능.

- **[INFO]** WITHDRAWN 마커의 영문·국문 혼용
  - target 위치: `## 변경` → `변경 4` (line 56) — "G1 헤딩 `⛔ BLOCKED` → `🚫 WITHDRAWN (2026-07-05)`"
  - 위반 규약: 명시적 conventions 파일 규정은 없음 (참고 관행 확인)
  - 상세: repo 내 기존 선례를 확인한 결과 `[~]` 체크박스(철회)·`🚫` 이모지(`plan/complete/channel-web-chat-followups.md` 의 "비목표 확정")는 모두 기 사용 패턴이라 신규 도입이 아니다. 다만 헤딩 라벨로 영문 `WITHDRAWN` 을 쓴 선례는 못 찾았다 — 기존 문서는 거의 전부 "철회"(국문)만 헤딩에 노출하고 영문은 안 쓴다(`~~헤딩~~ — 철회` 패턴, `refactor/06-concurrency.md` 등). 정식 규약 위반은 아니지만 국문 라벨 단독("🚫 철회 (2026-07-05)")이 기존 표기와 더 근접.
  - 제안: 선택 사항. "WITHDRAWN" 영문 병기를 유지해도 무방하나, 순수 국문 "🚫 철회 (2026-07-05)" 로 맞추면 기존 plan 전반의 표기와 완전히 통일된다.

- **[INFO]** cross-ref anchor·상대경로 표기 정확성 확인 — 이상 없음 (기록용)
  - target 위치: `변경 2` (line 65-68)
  - 상세: target 이 지적한 "`§11` 원문 line 1228 이 `../3-workflow-editor/...` 로 타 폴더를 참조했던 오류"는 실제 `spec/5-system/4-execution-engine.md:1228` 원문과 대조 확인됨 — 실제로 `spec [§8.2](../3-workflow-editor/3-execution.md#82-...)` 로 정의처를 오지칭하고 있었다. target 이 제안하는 정정 경로 `./6-websocket-protocol.md#42-실행-제어-명령-client--server` 는 실제 파일 위치(둘 다 `spec/5-system/` 동일 폴더)·실제 헤딩 슬러그(`### 4.2 실행 제어 명령 (Client → Server)` → `42-실행-제어-명령-client--server`)와 정확히 일치. `spec-link-integrity.test.ts` 가드 통과 예상.
  - 제안: 없음 (컴플라이언스 확인 완료, 조치 불요).

- **[INFO]** Planned 마커 표기(`_(계획·미구현)_`) 정합 확인 — 이상 없음
  - target 위치: `변경 3` (line 70-74)
  - 상세: target 이 제안하는 `api-convention.md §10.3` 신규 표기(`execution.start/stop/continue _(계획·미구현 — [6-websocket-protocol §4.2](...))_`)는 `6-websocket-protocol.md` 전역에서 이미 15회 이상 쓰인 `_(계획·미구현)_` italic 마커 컨벤션과 형식이 일치. 별도 규약 위반 없음.

## 요약

target 은 `spec/conventions/**` 의 명명·출력 포맷·API 문서 규약(`_(계획·미구현)_` 마커, anchor slug, 상대경로 규칙 등)을 위반하는 지점이 없으며, 인용한 line 번호·기존 서술 원문은 실제 spec 파일과 정확히 대조·일치한다(허구·왜곡 없음). 유일한 실질적 규약 이탈은 `project-planner` SKILL 이 spec-draft 문서에 의무화한 `## Rationale` 명시적 헤딩의 누락으로, 형제 draft 문서들의 일관된 준수 사례와 대비된다 — 콘텐츠는 이미 존재하므로 헤딩 재배치만으로 해소 가능한 경미한 구조 이탈이다. WITHDRAWN 마커의 영문 라벨 병기는 규약 위반이 아닌 스타일 참고 사항이다.

## 위험도

LOW
