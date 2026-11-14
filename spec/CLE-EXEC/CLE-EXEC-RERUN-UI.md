---
id: "CLE-EXEC-RERUN-UI"
title: "재실행 — 화면"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-RERUN"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-RERUN"]
area: "CLE-EXEC"
content_hash: "3de4d2d00a49a721ddaaec918ff453a78043c09c0ec19e44b037794bf74a6adf"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "b0565ef2c39684ba93ffc2d0d08d7b89e93b5c1775f8f3b7d5bb24eefed0ae74"
etag: "sha256-a2b56d31d54c26a4b5c6c10dd4bfc0c2464cb79dbd3dca84bc5c9cdd4c5ec6cf"
---
## 개요

이 문서는 [재실행](CLE-EXEC-RERUN.md) 의 하위 문서로 진입점, 재실행 모달, 마스킹된 입력 처리, 체인 표시, i18n 키를 정한다. 두 진입점 화면의 배치는 [실행 내역](CLE-EXEC-HISTORY.md) 과 [에디터 실행과 디버깅](CLE-EXEC-RUN.md) 이 정한다.

## 진입점

| 화면 | 위치 | 권한이 없을 때 |
| --- | --- | --- |
| 실행 상세 화면([실행 내역](CLE-EXEC-HISTORY.md)) | 요약 카드 오른쪽 머리 | 버튼을 비활성화하고 툴팁 "Re-run 권한이 없습니다 (정책 RR-PL-06)" |
| 실행 결과 드로어([에디터 실행과 디버깅](CLE-EXEC-RUN.md)) | 드로어 머리 오른쪽 | 버튼을 숨긴다(드로어는 워크플로우를 만드는 도중의 화면이라 소음을 줄인다) |

두 진입점 모두 같은 모달을 띄운다. 권한 판정(`canReRun`)은 [RR-PL-06](CLE-EXEC-RERUN-POLICY.md#rr-pl-06-권한-f) 을 따른다.

## 재실행 모달

모달에 무엇이 들어가는지는 [RR-PL-01](CLE-EXEC-RERUN-POLICY.md#rr-pl-01-외부-부수효과-안전장치-a5) 이 정한다. 이 절은 그 요소의 배치와 동작을 정한다.

| 영역 | 위치 | 들어가는 요소 |
| --- | --- | --- |
| 머리 | 위 | 제목 "Re-run Execution", 원본 실행(`#1234 · 2026-05-12 14:02:30 · ✅ Completed`) |
| 안내 | 머리 아래 | "이 워크플로는 외부 호출 노드 3개 — Send Email × 1, HTTP × 2 — 를 포함합니다." |
| 입력 데이터 | 가운데 | "원본 입력 그대로 사용 (RR-PL-02)" 토글, 파라미터별 필드(예: `name`, `count`, `extra.flag`) |
| dry-run | 입력 아래 | "dry-run 모드 (RR-PL-01) — 외부 호출 skip + mock 출력" 토글 |
| 버튼 | 아래 | 취소, 재실행 |

| 요소 | 기본값 | 동작 |
| --- | --- | --- |
| 원본 실행 머리 | 없음 | 원본 ID, 시작 시각, 최종 상태를 표시한다. ID 를 누르면 **새 탭**에서 원본 상세를 연다. 실행 상세 화면의 체인 배지 원본 링크는 **같은 탭**이다([실행 내역](CLE-EXEC-HISTORY.md)). 모달은 편집 맥락을 벗어나지 않으려고 새 탭, 체인 배지는 내비게이션이라 같은 탭이다(의도한 구분) |
| 부수효과 노드 안내 | 없음 | 워크플로우의 `supportsDryRun: true` 노드 수를 노드 유형별로 모아 보여 준다(`grouped by node.type`) |
| 입력 데이터 폼 | 원본의 `inputData.parameters` | 수동 트리거 parameters 스키마 기반 동적 폼. 필드 라벨과 타입은 워크플로우의 수동 트리거 노드 설정에서 가져온다. **스키마가 없으면**(수동 트리거 노드를 지운 경우 등) 원본 `inputData.parameters` 키를 타입 없는 텍스트 필드로 보여 줘 데이터가 숨지 않게 한다. 타입별 위젯은 string 텍스트, number 숫자, boolean 체크박스, object·array JSON 이다 |
| "원본 입력 그대로 사용" 토글 | 꺼짐(편집 가능) | 켜면 폼이 읽기 전용이 되고 "재실행" 버튼 한 번으로 끝난다. 화면은 토글 상태로 `useOriginalInput` 을 늘 명시해서 보낸다 |
| "dry-run 모드" 토글 | 꺼짐 | 워크플로우에 `supportsDryRun: false` 노드가 있으면 비활성화하고 툴팁 "이 워크플로는 dry-run 미지원 노드를 포함합니다 (RR-PL-01)" 를 단다([동작](CLE-EXEC-RERUN-DRYRUN.md#동작)) |
| "재실행" 버튼 | 없음 | 누르면 권한을 확인하고 `POST /api/executions/:id/re-run` 을 부른다. 실행 상세 화면에서는 응답의 새 실행 ID 로 `/w/<slug>/workflows/:workflowId/executions/:newId` 로 이동한다(현재 워크스페이스 slug 기준, [레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md)). 드로어에서는 이동하지 않고 에디터 안에서 새 실행을 지켜본다([에디터 실행과 디버깅](CLE-EXEC-RUN.md)) |
| "취소" 버튼 | 없음 | 모달을 닫고 바꾼 입력을 버린다 |

## 마스킹된 입력 처리

`Execution.inputData` 는 응답 단계에서 마스킹돼 내려온다. 입력 데이터 폼은 원본 `inputData.parameters` 를 미리 채우고 "원본 입력 그대로 사용" 토글의 UI 기본값은 꺼짐이다. 그래서 사용자가 폼을 건드리지 않아도 그 값이 `inputOverride` 로 다시 전송된다. 마스킹 마커가 그대로 다시 가면 리터럴 `'***'` 가 새 실행의 **실제 입력값**이 된다. 가시성이 떨어지는 문제가 아니라 데이터 오염이다. 그래서 모달과 서버가 마커를 막는다.

- **프리필하지 않는다**: 미리 채울 값이 마스킹 마커면 채우지 않고 그 필드를 비운 채 다시 입력하라고 안내한다.
- **제출을 막는다**: 사용자가 그 필드를 채우고 값에 마커가 남아 있지 않고 구조(object·array) 필드면 JSON 파싱에 성공할 때까지 제출을 막는다. 무효 JSON 으로 두면 파싱이 원문 문자열로 돌아가 마커 감지를 비켜 가므로 그 상태도 막는다. 안내만 하고 빈 문자열을 통과시키면 오염 값만 `'***'` 에서 `''` 로 바뀔 뿐이다. 그래서 "다시 입력하게 강제한다" 를 문구대로 구현한다.
- **토글을 켜는 것이 오히려 정답이다**: `useOriginalInput: true` 면 서버가 원본 엔티티를 직접 읽어 마스킹과 상관없이 원문으로 재실행한다. 이때는 차단도 풀린다.
- **서버가 한 번 더 막는다**: 위 차단은 화면 경로에 있어 UI 를 거치지 않는 클라이언트(`curl` 등)는 비켜 갈 수 있다. 그래서 서버가 `inputOverride` 의 값 가운데 마커와 **정확히 같은** 값이 있으면 `400 INVALID_TRIGGER_PARAMETERS` 와 `details[].code = MASKED_VALUE_RESUBMITTED` 로 거부한다. 오염이 실제로 일어나지 않는다. 화면 차단은 어느 필드가 문제인지 그 자리에서 보여 주는 안내로 남는다.

에디터의 "히스토리에서 불러오기" 는 같은 컬럼을 JSON 텍스트 전체로 채우므로 필드 단위로 비울 수 없다. 그쪽은 마커를 그대로 보여 주고 남아 있는 동안 실행을 막는다([에디터 실행과 디버깅](CLE-EXEC-RUN.md)). 마스킹 범위와 근거는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다.

## 체인 표시

실행 상세 화면 요약 카드에 체인 정보를 표시한다. 화면 배치는 [실행 내역](CLE-EXEC-HISTORY.md) 이 정한다. 체인 배지와 드롭다운은 [체인 조회 권한](CLE-EXEC-RERUN-POLICY.md#체인-조회-권한) 을 따르므로 뷰어를 포함한 워크스페이스 멤버 모두에게 보인다.

| 요소 | 표시 조건 | 내용 |
| --- | --- | --- |
| 체인 배지 | `re_run_of != null` | "#N-th re-run"(체인의 N번째 재실행)과 원본 실행 ID 링크. dry-run 이면 "· dry-run" 을 붙인다 |
| "View chain" 드롭다운 | 체인의 실행이 2개 이상 | 누르면 같은 체인의 모든 실행을 펼친다. 항목마다 ID, 시작 시각, 최종 상태, dry-run 여부 |

## i18n 키

| 키 | 한국어 | 영어 |
| --- | --- | --- |
| `history.actions.rerun` | 재실행 | Re-run |
| `history.rerun.modal.title` | 실행 다시 시작 | Re-run Execution |
| `history.rerun.modal.originalLabel` | 원본 실행 | Original Execution |
| `history.rerun.modal.sideEffectWarning` | 이 워크플로는 외부 호출 노드 {{count}}개를 포함합니다 | This workflow includes {{count}} external-call node(s) |
| `history.rerun.useOriginalInput` | 원본 입력 그대로 사용 | Use original input |
| `history.rerun.maskedInputBlocked` | 자격증명으로 판별돼 가려진 입력이 있어요. 해당 항목을 직접 입력하거나 '원본 입력 그대로 사용'을 켜 주세요. | Some inputs were masked as credentials. Enter them directly, or turn on "Use original input". |
| `history.rerun.dryRunToggle` | dry-run 모드 (외부 호출 skip) | Dry-run mode (skip external calls) |
| `history.rerun.dryRunDisabledTooltip` | 이 워크플로는 dry-run 미지원 노드를 포함합니다 | This workflow contains nodes that don't support dry-run |
| `history.rerun.confirmButton` | 재실행 | Re-run |
| `history.rerun.cancelButton` | 취소 | Cancel |
| `history.rerun.chainBadge` | #{{n}}-th re-run | #{{n}}-th re-run |
| `history.rerun.chainBadgeDryRun` | dry-run | dry-run |
| `history.rerun.chainOrigin` | 원본 | original |
| `history.rerun.viewChain` | chain 보기 ({{count}}) | View chain ({{count}}) |
| `history.rerun.permissionDenied` | Re-run 권한이 없습니다 (정책 RR-PL-06) | You don't have permission to re-run (RR-PL-06) |
| `history.rerun.chainDepthExceeded` | 같은 체인의 재실행이 한도(32)에 도달했습니다 | This chain has reached the re-run depth limit (32) |
| `history.rerun.workflowDeleted` | 원본 실행의 워크플로가 삭제되어 재실행할 수 없습니다 | The workflow of the original execution has been deleted |
| `history.rerun.dryRunNotApplicable` | 이 워크플로는 dry-run 모드로 재실행할 수 없습니다 | This workflow cannot be re-run in dry-run mode |
| `history.rerun.assistantBlocked` | Re-run 은 사용자가 실행 상세 페이지에서 직접 트리거해야 합니다 (RR-PL-07) | Re-run must be triggered manually on the execution detail page (RR-PL-07) |

화면 문구 자체의 기준은 i18n 사전이다([다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md)).

## 구현 위치

- `codebase/frontend/src/components/executions/rerun-modal.tsx`
- `codebase/frontend/src/lib/executions/can-rerun.ts` (`canReRun`, 재실행 버튼 판정)

## Rationale

### 입력 데이터 마스킹을 예외로 두지 않고 마커를 막는다 (2026-08-20)

2026-08-20 이전에는 `Execution.inputData` 만 응답 마스킹에서 뺐다. 마스킹하면 모달이 미리 채운 `'***'` 가 새 실행의 실제 입력값이 되기 때문이다. 이제는 이 컬럼도 마스킹하고 대신 모달이 마커를 미리 채우지 않으며 서버가 마커 재전송을 거부한다([마스킹된 입력 처리](#마스킹된-입력-처리)). 마스킹 정책의 근거는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 에 있다.
