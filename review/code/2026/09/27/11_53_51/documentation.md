# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 트래커 문서가 아직 `in-progress` 인 plan 을 `plan/complete/` 경로로 앞당겨 인용한다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:1396`
  - 상세: 해당 줄은 `FolderDto(`plan/complete/folders-contract-e2e.md` — 폴더 e2e 신설. …)` 라고 적어, 이번 작업의 plan 문서가 이미
    `plan/complete/` 로 옮겨진 것처럼 인용한다. 그러나 실제로 그 plan 은 지금 `plan/in-progress/folders-contract-e2e.md` 에 있고
    (`status: in-progress`), 체크리스트 마지막 두 항목(`/ai-review`, `--impl-done`)도 아직 미체크다 — `plan/complete/folders-contract-e2e.md`
    는 저장소에 존재하지 않는다(확인함: `find` 결과 0건). 같은 트래커 파일 안의 다른 `plan/complete/…` 인용은 전부 이미 "해소"·"닫힘"
    마커가 붙은, 실제로 이관된 plan 만 가리킨다 — 이 줄만 유일하게 아직 진행 중인 plan 을 미리 완료 경로로 적은 예외다.
    이 프로젝트 관례상 체크박스 완료와 `plan/complete/` 이관은 "한 동작"으로 마무리 커밋에서 함께 일어난다. 그 마무리 커밋이
    실제로 일어나지 않거나(예: 이번 PR 이 이 상태로 머지되거나, 마무리 단계에서 이관을 깜빡하면) 이 인용은 존재하지 않는 파일을
    가리키는 죽은 링크로 영구히 남는다.
  - 제안: 마무리 커밋(plan 이관 + 체크박스 완료) 이 실제로 일어났는지 push 전에 확인한다. 아직이라면 이 줄을 지금 시점 기준
    `plan/in-progress/folders-contract-e2e.md` 로 고치고, 실제 이관 시점에 `plan/complete/…` 로 다시 정정하거나, "닫히면 `plan/complete/`
    로 옮겨질 예정" 식으로 잠정 표현을 쓴다.

## 요약

이번 변경은 문서화 관점에서 전반적으로 높은 수준이다 — `folders.service.ts` 의 `Object.assign` 결함 원인·증상·TypeORM 내부 동작까지
설명하는 인라인 주석이 서비스 코드·단위 테스트·e2e 테스트·plan 문서 네 곳에서 서로 어긋남 없이 일관되게 반복되고, `FolderDto.parentId`
타입 선언 이유(§5.4 기본형·`type: String` 명시 이유)도 정확히 근거(#1412 실측)와 함께 적혀 있다. `CHANGELOG.md` 항목은 파일 상단
"무엇이 항목을 만드는가" 기준(API 응답 계약 변경)에 정확히 부합하고, 반증된 POST 전제(parentId 키 부재)를 항목에 다시 싣지 않아
정확하다. 신규 캐너리 테스트(`folder-response.dto.spec.ts`)와 서비스 회귀 테스트에는 "왜 래칫·e2e 로 부족한가" 를 설명하는 JSDoc 이
붙어 있어 향후 유지보수자가 목적을 오해할 가능성이 낮다. 유일하게 발견한 흠은 트래커 문서 한 줄이 아직 완료되지 않은 자기 자신의 plan
을 `plan/complete/` 경로로 미리 인용한 것으로, 기능적 결함은 아니지만 마무리 절차가 어긋나면 죽은 링크가 될 수 있는 사소한 정확성
문제다. README·API 문서·환경변수 문서 갱신은 이번 변경 범위에 해당하지 않아 불필요하다.

## 위험도
LOW
