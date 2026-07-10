### 발견사항

- **[WARNING]** 파일 상단 모듈 주석이 `truncation` 필드 추가를 반영하지 못해 `asEnvelope` JSDoc과 불일치
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:1-5` (모듈 헤더 주석) vs `presentation.ts:107-119` (`asEnvelope` JSDoc, 이번 diff로 갱신됨)
  - 상세: 이번 변경으로 `asEnvelope` 바로 위 JSDoc은 `PresentationPayload { type, toolCallId, renderedAt, payload, truncation? }`로 정확히 갱신됐으나, 파일 최상단 요약 주석(`// AI render_* 도구: PresentationPayload { type, toolCallId, renderedAt, payload } (데이터는 .payload 중첩).`)은 `truncation?` 필드가 빠진 채로 남아 있다. 이 파일을 처음 읽는 사람은 보통 최상단 요약부터 읽으므로, 두 주석이 서로 다른 shape 정의를 제시하는 상태가 된다. review checklist 4번("기존 주석이 변경된 코드와 일치하는지")에 정확히 해당하는 staleness다.
  - 제안: 모듈 헤더의 shape (2) 설명에도 `truncation?`을 추가해 `asEnvelope` JSDoc과 문구를 맞춘다. 예: `PresentationPayload { type, toolCallId, renderedAt, payload, truncation? }`.

- **[INFO]** 신규 JSDoc에서 마크다운 링크 문법이 파일의 기존 관례와 다름
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:117` — `([Presentation 공통 §10.4](spec/4-nodes/6-presentation/0-common.md))`
  - 상세: 같은 파일의 다른 spec 참조들(1행 `spec/4-nodes/6-presentation/*`, 119행 `spec/7-channel-web-chat/1-widget-app §2 · AI Agent §7.10`)은 모두 일반 텍스트 경로/섹션 표기를 쓰는데, 이번에 추가된 한 줄만 마크다운 `[text](path)` 링크 문법을 사용한다. TS 주석은 마크다운 렌더링이 되지 않고, 경로도 저장소 루트 기준이라 파일 기준 상대경로로 오인될 수 있어 실질적 이득이 없다.
  - 제안: 필수는 아니나, 파일 내 다른 참조와 동일하게 plain 텍스트 표기(`Presentation 공통 §10.4 (spec/4-nodes/6-presentation/0-common.md)`)로 통일하면 일관성이 좋아진다.

- **[INFO]** `asEnvelope` JSDoc 및 인라인 주석 품질은 모범적
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:107-119, 128`
  - 상세: "무엇을"뿐 아니라 "왜"(config에는 truncation을 섞지 않고 output에만 흡수하는 이유, aliasing 차단 이유, 흡수하지 않을 때의 구체적 회귀 증상 — 1MB cap 배너가 영영 안 뜸)까지 명시하고 spec 섹션(§7.10, §10.4)까지 cross-ref한다. `// truncation 부재 시 asRecord 가 {} 를 주므로 spread 는 no-op.` 인라인 주석도 실제 `asRecord` 구현(88-90행, `v && typeof v === "object" ? v : {}`)과 정확히 일치해 근거 있는 서술이다. 리뷰 관점 1·5에 대한 긍정 사례.

- **[INFO]** 테스트 파일들의 설명 주석이 spec 근거·회귀 시나리오를 정확히 명시
  - 위치: `codebase/channel-web-chat/src/lib/conversation.test.ts:43-46`, `presentation.test.ts:128-130, 142, 164`, `presentations.test.tsx:238-239, 288`
  - 상세: 각 신규 `describe`/`it` 블록 앞에 "왜 이 테스트가 존재하는가"(회귀 가드 대상, spec 섹션, 실패 시 증상)를 명시한 주석이 붙어 있고, 이는 `presentation.ts`의 JSDoc 서술과 문구·근거가 정확히 일치한다(예: "1MB cap 배너가 영영 안 뜬다" 문구가 코드 주석·테스트 주석·plan 문서 3곳에서 동일하게 재사용됨). 별도 지적 사항 없음.

- **[INFO]** spec 문서 정정(`1-widget-app.md`, `_product-overview.md`, `conversation-thread.md`)이 직전 consistency-check(22_27_45) 발견사항을 같은 커밋에서 대부분 해소
  - 위치: `spec/7-channel-web-chat/1-widget-app.md` §2·§3.1, `spec/7-channel-web-chat/_product-overview.md` 비목표 목록, `spec/conventions/conversation-thread.md` §2.1
  - 상세: 1차 consistency-check(WARNING 1: SoT 컨벤션 문서 미등록, INFO 1: 비목표 목록 누락, INFO 4: §3.1 "전체 히스토리 복원" 오독 여지)가 지적한 3건 모두 이번 diff에 반영됐다(`conversation-thread.md` §2.1에 표시-전용 노드 미영속 규칙 신설, `_product-overview.md` 비목표 항목 추가, `1-widget-app.md` §3.1에 "§2 참조" 상호참조 추가). 문서 정정 워크플로가 잘 수렴한 사례로 특기할 만하다. 다만 INFO 3(§6.3 로드맵 미러 등재 여부 명시)는 plan의 Rationale R2-a에서만 다뤄지고 spec 자체(`0-overview.md §6.3`)에는 반영되지 않았는데, R2-a가 "영역 백로그 SoT에만 등재하고 루트 로드맵에는 미러하지 않는다"는 명시적 선택을 근거와 함께 기록했으므로 결함은 아니다.

- **[INFO]** `--impl-prep` 단계에서 발견된 사전 존재 문서 drift 3건(EIA rate-limit "Planned" 오기재, NAV-WC-06 상태 stale, `embed-config` 응답 `{data}` 봉투 표기 누락)은 이번 diff에 포함되지 않음
  - 위치: `spec/7-channel-web-chat/4-security.md` §4, `spec/2-navigation/_product-overview.md` NAV-WC-06, `spec/7-channel-web-chat/3-auth-session.md` §3 step 0 · `4-security.md` §3-①/Rationale I3
  - 상세: `plan/in-progress/widget-presentation-restore.md` §5가 이 3건을 "본 변경과 무관한 사전 존재 spec drift"로 명시적으로 범위 밖 처리하고 project-planner 팔로우업으로 분리했다. 프로젝트 컨벤션(WARNING은 fix or 근거 있는 defer)에 부합하는 처리이며 CRITICAL이 아니므로 이번 PR을 막을 사유는 아니다. 다만 세 항목 모두 문서 판독 시 리뷰어/구현자를 오도할 수 있는 내용(예: "아직 미구현"으로 잘못 읽고 중복 구현 시도)이라, plan §5에 기록된 대로 별도 spec-draft 팔로우업이 실제로 이어지길 권장한다(추적만 되고 착수가 안 되면 재발견 비용이 남는다).

- **[INFO]** README/CHANGELOG 업데이트 불필요 확인
  - 위치: `codebase/channel-web-chat/README.md` (CHANGELOG 파일은 저장소에 존재하지 않음)
  - 상세: README는 presentation 렌더러 존재만 상위 레벨로 언급하고 shape 정규화·truncation 흡수 같은 내부 구현 세부는 다루지 않는다. 이번 변경은 내부 버그 수정(위젯 라이브러리 내부 로직)이라 공개 API·설정·사용법 변경이 없어 README/CHANGELOG 갱신 대상이 아니다. API 문서(Swagger/DTO)·환경변수·예제 코드도 이번 diff의 성격(REST/WS 표면 무변경, 신규 설정 없음, 내부 정규화 함수)상 해당 사항 없음 — convention_compliance checker 결과와도 일치.

### 요약

이번 변경은 (1) 위젯 내부 `asEnvelope`의 `truncation` 흡수 버그 수정 코드 4개 파일과 (2) 그 근거가 되는 spec 문서 3개 파일(`1-widget-app.md`, `_product-overview.md`, `conversation-thread.md`) 정정으로 구성된, 문서화 관점에서 상당히 모범적인 PR이다. `asEnvelope`의 JSDoc은 "무엇을" 넘어 "왜"와 "고치지 않으면 어떤 증상이 나는지"까지 구체적으로 설명하고, 신규 테스트들의 주석도 동일한 근거·spec 섹션을 재사용해 코드-테스트-spec 3자가 정확히 정합한다. spec 문서 정정도 직전 consistency-check가 지적한 SoT 미등록·비목표 누락·상호참조 부재를 같은 커밋에서 대부분 해소했다. 유일하게 실질적인 흠은 `presentation.ts` 파일 최상단 모듈 요약 주석이 이번에 추가된 `truncation` 필드를 반영하지 못해 더 상세한 `asEnvelope` JSDoc과 불일치하는 점(WARNING)이며, 이는 한 줄 수정으로 해소 가능한 경미한 staleness다. `--impl-prep` 단계에서 발견된 3건의 사전 존재 spec drift(EIA rate-limit·NAV-WC-06·embed-config 봉투 표기)는 이번 PR과 무관하고 plan에 팔로우업으로 명시적으로 기록돼 있어 차단 사유가 아니다.

### 위험도
LOW