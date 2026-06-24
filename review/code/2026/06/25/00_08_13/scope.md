# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 파일 1 (`external-interaction.module.ts`) — `NodeExecution` 임포트 및 `TypeOrmModule.forFeature` 배열 확장
  - 위치: diff +1 import, +4 lines in forFeature array
  - 상세: `interaction.service.ts` 가 `nodeExecutionRepository` 를 주입받기 위한 필수 모듈 등록이다. 서비스 생성자에 `@InjectRepository(NodeExecution)` 가 추가됐으므로 모듈에서 해당 entity 를 등록하지 않으면 런타임 오류가 발생한다. 범위 내 필수 변경.
  - 제안: 없음 (정당한 변경).

- **[INFO]** 파일 2 (`interaction.service.spec.ts`) — `nodeRepo` mock 추가 + `getStatus` 단위 테스트 2건 추가
  - 위치: `makeMocks()` 함수, `describe('InteractionService.getStatus')` 블록 끝
  - 상세: 백엔드 `getStatus` 가 `NodeExecution` 조회를 신규로 수행하므로 생성자 인자가 1개 증가했고, 기존 테스트 픽스처 `makeMocks()` 에 그에 맞는 mock repo 를 추가하는 것은 필수다. 신규 테스트 2건(buttons 표면 복원, NodeExecution 없을 때 null)은 이번 기능의 정확한 커버리지다. 범위 내 필수 변경.
  - 제안: 없음.

- **[INFO]** 파일 3 (`interaction.service.ts`) — `NodeExecution`/`NodeExecutionStatus` 임포트 + 생성자 주입 + `getStatus` 로직 교체
  - 위치: 임포트 블록, 생성자, `getStatus()` 메서드 (219–283라인 구간)
  - 상세: 이번 fix 의 핵심 백엔드 변경. `WAITING_FOR_INPUT` 상태의 `currentNode`/`context` 를 `null` 하드코딩에서 `NodeExecution.outputData` 재구성으로 교체한 것은 커밋 메시지에 명시된 목표(1)과 정확히 일치한다. 추가된 주석은 EIA spec 참조 및 wire 형식 동일성 설명으로, 해당 로직 이해에 직접 기여한다. 범위 내 필수 변경.
  - 제안: 없음.

- **[INFO]** 파일 4 (`use-widget-eager-start.test.ts`) — `race fix` 테스트 2건 추가
  - 위치: `describe("useWidget — eager 시작(§R6)")` 블록 끝
  - 상세: "getStatus 시드로 buttons 표면 복원" 테스트와 "openStream lastEventId=0 으로 buffer replay 요청" 테스트 각각 1건. 두 테스트 모두 `use-widget.ts` 에 추가된 `seedWaitingFromStatus` 및 `openStream(session, "0")` 변경을 직접 검증한다. 기존 테스트 코드는 수정되지 않았다. 범위 내 필수 변경.
  - 제안: 없음.

- **[INFO]** 파일 5 (`use-widget.ts`) — `seedWaitingFromStatus` 콜백 추가 + `startExecution`/`applyConfig` 내 호출 삽입
  - 위치: `useWidget` 함수 내 ~175–897라인 구간
  - 상세: 커밋 메시지 "(2) 위젯 replay" 와 "(1b) 위젯 status 시드" 를 구현한다. `seedWaitingFromStatus` 는 새 기능이나 기존 흐름 외부에 독립 콜백으로 추가됐고, start/restore 경로 두 곳에만 삽입됐다. 기존 로직 리팩토링 없음. 삽입된 주석은 race 경로 설명으로 코드 이해에 직접 기여한다. 범위 내 필수 변경.
  - 제안: 없음.

- **[INFO]** 파일 6 (`k8s/README.md`) — CORS 분리배포 경고 blockquote 추가 (6라인)
  - 위치: `### 6. (옵셔널) 동봉 위젯` 섹션 아래
  - 상세: 커밋 메시지에 "k8s/README CORS 운영 안내" 가 명시돼 있다. 운영자가 프론트/API 분리 배포 시 `WEB_CHAT_WIDGET_ORIGINS` 를 놓쳐 CORS 로 막히는 시나리오를 문서화한다. 기존 문서 내용 수정 없이 새 blockquote 만 삽입했다. 범위 내 정당한 문서 보완.
  - 제안: 없음.

- **[INFO]** 파일 7 (`plan/in-progress/web-chat-preview-eia-race-fix.md`) — 신규 plan 파일 생성
  - 위치: 신규 파일 (51라인)
  - 상세: 이번 작업의 배경·핵심 사실·실행 계획을 기록한 plan 파일이다. 항목 체크박스가 구현·문서 완료를 반영한다. `status: in-progress` 는 리뷰·PR 단계가 남아있어 정확하다. 범위 내 계획 문서.
  - 제안: 없음.

- **[INFO]** 파일 8 (`spec/5-system/14-external-interaction-api.md`) — §5.3 `currentNode`/`context` 구현 상태 노트 갱신
  - 위치: `### 5.3 단발 상태 조회` 섹션의 구현 상태 blockquote
  - 상세: 기존 "currentNode/context 는 항상 null (Planned)" 노트를 "WAITING_FOR_INPUT 시 NodeExecution.outputData 에서 복원" 구현 설명으로 교체했다. 커밋 메시지의 "EIA §5.3(getStatus 구현)" 문서 과업과 정확히 일치한다. 범위 내 spec 동기화.
  - 제안: 없음.

- **[INFO]** 파일 9 (`spec/7-channel-web-chat/4-security.md`) — §2.1 끝에 분리배포 CORS 주의 항목 추가
  - 위치: `### 2.1 구현 (코드 SoT)` 마지막 bullet
  - 상세: 커밋 메시지의 "7-channel 4-security §2" 문서 과업과 일치한다. 기존 내용 수정 없이 새 bullet 을 append 했다. 범위 내 spec 보완.
  - 제안: 없음.

- **[INFO]** 파일 10 (`spec/7-channel-web-chat/5-admin-console.md`) — §6 에 "첫 노드 race 보정" 설명 추가 + CORS 설명 확장
  - 위치: `## 6. 라이브 미리보기` 섹션, CORS bullet
  - 상세: 커밋 메시지의 "5-admin-console §6" 문서 과업과 일치한다. 기존 CORS bullet 을 분리배포 케이스를 포함하도록 확장하고 "첫 노드 race 보정" 신규 설명을 추가했다. 기존 나머지 문서는 수정되지 않았다. 범위 내 spec 보완.
  - 제안: 없음.

## 요약

10개 파일 전체가 커밋 메시지에 명시된 세 가지 목표 — (1) 백엔드 `getStatus` `waiting_for_input` 표면 복원, (2) 위젯 SSE `lastEventId=0` replay + `getStatus` 시드, (3) CORS 분리배포 운영 문서 — 와 직접 대응한다. 의도하지 않은 리팩토링, 불필요한 포맷팅 변경, 범위 외 파일 수정은 발견되지 않았다. 각 파일의 변경량이 해당 기능 구현·테스트·문서화에 필요한 최소 범위에 머문다. plan 파일(파일 7)과 spec 파일(파일 8·9·10)은 프로젝트 규약상 구현과 병행 갱신이 요구되므로 포함이 정당하다.

## 위험도

NONE
