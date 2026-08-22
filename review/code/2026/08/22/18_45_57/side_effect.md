# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 리뷰 대상 24개 파일 전부가 `plan/**`·`review/**`·`spec/**` 문서(`.md`)와 consistency-check 세션 메타데이터(`.json`)이며, 실행 코드(`.ts`/`.js` 등)는 포함되지 않았다.
  - 위치: 전체 diff (파일 1~24, `plan/in-progress/spec-draft-egress-masking-convention.md` 외 23개)
  - 상세: "부작용" 점검 관점(상태 변경·전역 변수·시그니처/인터페이스 변경·환경 변수·네트워크 호출·이벤트/콜백)은 모두 실행 코드의 런타임 동작을 전제로 한다. 이번 변경은 (1) 신규 conventions 문서(`spec/conventions/egress-masking.md`) 작성, (2) 기존 spec 3곳(`14-external-interaction-api.md` §R17, `6-websocket-protocol.md`, `node-output.md`)에 그 문서로의 상호참조 링크(콜아웃) 추가, (3) plan 트래커(`spec-sync-external-interaction-api-gaps.md`)의 체크박스 갱신과 동반 갱신 트리거 주석 추가, (4) `plan/in-progress/spec-draft-egress-masking-convention.md` 신규 draft, (5) `review/consistency/2026/08/22/{18_14_17,18_14_45,18_27_11}/**` 아래 `/consistency-check --spec` 실행 산출물(SUMMARY·checker별 리포트·`_retry_state.json`·`meta.json`)로 구성된다. 이 저장소 관례상 `review/**`는 gitignore 대상이 아니라 커밋되는 산출물이므로(MEMORY: "plan 체크박스... review/ 는 gitignored 아님"), 이 JSON/MD 파일들의 신규 생성은 "예상치 못한 파일시스템 부작용"이 아니라 `/consistency-check` 실행이 남기는 **의도된 감사 흔적**이다.
  - 제안: 조치 불필요. 코드 리뷰 관점에서는 이 카테고리에 해당 사항 없음(N/A).

- **[INFO]** 신규 conventions 문서의 `code:` frontmatter가 소유권을 선언하는 6개 소스 파일(`masked-markers/src/index.ts`, `sanitize-error-message.ts`, `strip-external-only-fields.ts`, `websocket.service.ts`, `reject-masked-resubmission.ts`, `frontend/.../masked-markers.ts`) 자체는 이번 diff에 포함되지 않았다.
  - 위치: `spec/conventions/egress-masking.md` frontmatter (파일 23, 게이트 4~10행)
  - 상세: 이는 `spec-code-paths.test.ts` 가드가 "해당 파일들이 실재하는지"만 검사하는 문서-코드 연결 선언이다. 이번 PR 은 이 6개 파일의 동작을 전혀 바꾸지 않으므로, 문서가 코드보다 앞서 나가거나(문서화된 보장이 구현보다 넓어지는) 위험은 문서 자체가 §2·§3에서 이미 범위를 `toFanoutEnvelope` 경로로 한정하고 "확인 전 전 경로 불변식이라 쓰면 안 된다"고 명시하며 방어하고 있다.
  - 제안: 조치 불필요. 실제 코드 변경이 뒤따를 때(트래커 W4 "4곳 헬퍼 통합" 등) 이 문서의 좌표계 표·소비처 열이 동반 갱신되는지가 다음 코드 PR 의 리뷰 포인트다.

- **[INFO]** `review/consistency/2026/08/22/18_14_17/_retry_state.json` (파일 3)의 `agents_pending`/`agents_success`/`agents_fatal` 등은 세션 시작 시점의 초기 상태(전부 pending, 성공/실패 0건)를 기록한 스냅샷이다.
  - 위치: `review/consistency/2026/08/22/18_14_17/_retry_state.json`
  - 상세: 이 파일이 커밋된 상태로 보존된다는 것은 (재실행 시 이 상태를 다시 읽어 재개하는) orchestrator 재시도 상태기계의 산출물이 그대로 이력에 남는다는 의미다. 부작용이라기보다 `subagent-call-contract.md` 가 규정하는 정상 동작이며, 이번 diff 범위에서 새로 도입된 전역/공유 상태는 아니다(세션 디렉터리 하위 로컬 파일).
  - 제안: 조치 불필요.

## 요약

이번 변경분은 전부 `spec/`·`plan/`·`review/` 아래의 마크다운 문서와 consistency-check 세션 산출물(JSON)이며, 백엔드/프런트엔드 실행 코드는 단 한 줄도 포함되어 있지 않다. 따라서 부작용 리뷰의 8개 관점(상태 변경, 전역 변수, 시그니처/인터페이스 변경, 환경 변수, 네트워크 호출, 이벤트/콜백)은 실질적으로 적용 대상이 없다(N/A). 유일하게 관련 있는 항목은 "파일시스템 부작용"인데, 신규 생성되는 모든 파일(신규 convention 문서·plan draft·review 세션 산출물)은 `/consistency-check --spec` 실행과 project-planner 워크플로가 의도적으로 남기는 정상 산출물이며 이 저장소 관례(`review/**`는 커밋 대상)와 일치한다. 예상 외의 상태 변경이나 숨은 부작용은 발견되지 않았다.

## 위험도
NONE
