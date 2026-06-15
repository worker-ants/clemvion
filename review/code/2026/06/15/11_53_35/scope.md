# 변경 범위(Scope) 리뷰

## 발견사항

이번 변경은 spec/3-workflow-editor/3-execution.md §2.2 "테스트 데이터셋 저장/이름 지정" 기능을 구현한 PR이다. 총 23개 파일이 변경됐으며, 의도된 범위는 다음과 같다: DB 마이그레이션, 백엔드 모듈(entity/DTO/service/controller), 프론트엔드 UI(toolbar + API client), i18n, 문서, spec 동기화.

범위 일탈 사항은 발견되지 않았다.

- **[INFO]** `app.module.spec.ts` — `toastSuccess` mock 추가
  - 위치: 파일 2, 전체 파일은 `app.module.spec.ts`가 아니라 파일 14 `editor-toolbar-run-input.test.tsx`
  - 상세: `editor-toolbar-run-input.test.tsx`에서 `toastSuccess = vi.fn()`을 추가하고 `toast.success` mock을 명시적으로 추적하도록 변경했다. 기존 코드에서는 `toast.success: vi.fn()`으로 익명 모킹이었는데, 데이터셋 저장 성공/복제 성공/삭제 성공 toast를 테스트에서 검증하기 위해 named mock이 필요했다. 이는 §2.2 데이터셋 기능 테스트를 지원하기 위한 최소 변경으로 범위 내 조정이다.
  - 제안: 해당 없음 (범위 내 변경).

- **[INFO]** `editor-toolbar.tsx` — History 피커 버튼 레이아웃 변경
  - 위치: 파일 15, diff 라인 `-530~-537 → +738~+765` 구간
  - 상세: "Load from History" 버튼이 단독 `<Button>` 에서 새로 추가된 Datasets 버튼과 함께 `<div className="flex items-center gap-1">` 래퍼 안으로 들어갔다. 기존 버튼 자체의 로직·속성은 변경되지 않고 레이아웃 컨테이너만 추가됐다. Datasets 버튼 추가에 따른 필수적 UI 구조 변경이므로 범위 내다.
  - 제안: 해당 없음.

- **[INFO]** Cancel 버튼 onClick 핸들러에 상태 초기화 추가
  - 위치: 파일 15, diff 라인 `+898~+907` (기존 Cancel onClick에 `setDatasetPickerOpen(false)`, `setSaveFormOpen(false)`, `setDatasetName("")`, `setShareWorkspace(false)` 추가)
  - 상세: 신규 데이터셋 관련 상태들을 Cancel 시 초기화하는 코드가 기존 Cancel 핸들러에 병합됐다. 기능 확장이 아닌 기존 "닫기 시 상태 리셋" 패턴의 자연스러운 연장이며 필수 변경이다.
  - 제안: 해당 없음.

- **[INFO]** `plan/in-progress/spec-sync-execution-gaps.md` — plan 체크박스 갱신
  - 위치: 파일 21, diff 라인 `§2.2` 항목 변경
  - 상세: `[ ]` → `[x]` 완료 표기 및 구현 상세 기록, 이후 수행할 review/test 작업 체크박스 추가. plan 추적 파일 갱신은 SDD 워크플로우의 표준 절차다.
  - 제안: 해당 없음.

- **[INFO]** `spec/1-data-model.md` — 섹션 번호 `2.13.3` 추가
  - 위치: 파일 22
  - 상세: 기존 `2.13`(ExecutionToken) 다음에 `2.13.3 WorkflowTestDataset`이 삽입됐다. 섹션 번호 체계상 `2.13.3`은 `2.13`의 하위 섹션처럼 보이지만, 실제 파일 맥락을 보면 `2.14 NodeExecution` 직전에 위치한다. 신규 엔티티의 데이터 모델 동기화는 spec 관리 절차상 필요한 변경이다.
  - 제안: 번호 체계 이슈(2.13 → 2.13.3)는 spec 일관성 문제이나 scope 범위 일탈이 아닌 별도 spec 정합성 이슈다.

범위 이탈에 해당하는 변경은 발견되지 않았다.

## 요약

이번 변경은 §2.2 워크플로우 테스트 데이터셋 기능 구현에 필요한 파일들만 수정했으며, 의도된 범위를 벗어나는 리팩토링·기능 확장·무관 코드 수정은 없다. 23개 파일 모두 새 기능(DB 마이그레이션, NestJS 모듈, frontend UI, i18n, 문서, spec 동기화)의 직접적 구성 요소다. 기존 코드에 가해진 수정(app.module.ts 모듈 등록, root-entities.ts 엔티티 추가, editor-toolbar.tsx 버튼 래핑, Cancel 핸들러 상태 초기화, 기존 테스트의 toast mock 확장)은 모두 신규 기능과의 연결에 필수적인 최소 변경에 해당한다. 불필요한 포맷팅 변경, 임포트 정리, 무관 설정 변경은 발견되지 않았다.

## 위험도

NONE
