# Requirement Review — web-chat-page.test.tsx (multiple-match fix)

## 발견사항

### [INFO] 테스트 로드 게이트로서 `findAllByText` 적합성
- 위치: diff 전체 (`findByText` → `findAllByText` 6곳)
- 상세: `findByText`는 DOM 에 정확히 1개 매칭을 요구하므로, `page.tsx:121`(목록 행 `inst.name`) 과 `page.tsx:231`(상세 헤더 `{instance.name}`)이 동일 텍스트를 동시에 렌더하는 #692 이후 구조에서 TestingLibrary `multiple elements with the same text` 오류가 발생한다. `findAllByText`는 ≥1 매칭을 반환하고 해당 요소들이 존재하면 resolve하므로 "페이지가 로드됐음을 대기한다"는 원래 의도를 정확히 보존한다. 기능 완전성·의도-구현 일치 양면에서 올바른 수정이다.

### [INFO] interaction 필터 단언 (`length > 0`) 표현 방식
- 위치: diff +60행 (`expect((await screen.findAllByText("Support bot")).length).toBeGreaterThan(0)`)
- 상세: 현재 표현은 기능상 정확하다 — `findAllByText`는 매칭이 없으면 timeout 예외를 던지므로, `.length > 0` 추가 단언은 엄밀히 중복이지만 "목록에 나타남"을 명시적으로 선언한다는 의도가 있다. 선택적으로 `toHaveLength(1)` 또는 `toHaveLength(2)`로 바꾸면 렌더 횟수까지 고정 검증 가능하나 이는 스타일 문제이지 결함은 아니다.

### [INFO] 들여쓰기 비일관성 (코드 품질)
- 위치: diff +102–103, +113–114, +124–125 (`describe("저장 버튼 흐름")` 블록 내 3개 `findAllByText` 호출)
- 상세: 변경된 주석 라인과 `await screen.findAllByText(...)` 라인이 `it` 본문 들여쓰기 기준(4-space)보다 2칸 짧다. 외부 `it` 블록(+69–71, +80–82, +91–93)은 일관된 들여쓰기를 유지한다. 기능에는 영향 없으나 코드 스타일 규범 위반이다.

### [INFO] spec fidelity — 테스트 전용 변경, spec 커버리지 영향 없음
- 위치: `spec/7-channel-web-chat/5-admin-console.md`
- 상세: 변경 대상은 순수 테스트 파일이고 production 코드는 무변경이다. spec §1(화면 구조) 다이어그램이 인스턴스 이름을 목록 행과 상세 헤더 양쪽에 노출함을 나타내며("고객지원 봇 [활성]" 헤더), 이중 렌더는 spec 의도에 부합한다. 테스트가 그 이중 렌더를 올바르게 수용하도록 수정됐으므로 spec 위반 없음.

### [INFO] `저장 성공/실패` 테스트의 조건부 클릭 (`if (!saveBtn.hasAttribute("disabled"))`)
- 위치: 전체 파일 컨텍스트 lines 400–406, 425–431
- 상세: 이번 커밋 변경 범위 밖이나 리뷰 대상 파일에 존재한다. 저장 버튼이 disabled 면 toast 단언을 건너뛰는 방어 로직이 있어, 실제로 버튼이 disabled 인 버그가 있어도 테스트가 통과하는 false-positive 위험이 있다. 이번 커밋 범위 밖이므로 INFO 로만 기록한다.

---

## 요약

본 변경은 #692(웹채팅 운영 콘솔)가 인스턴스 이름을 목록 행과 상세 헤더 양쪽에 렌더하게 된 이후 `findByText` 단일-매칭 가정이 깨진 7개 테스트를 수정한다. 모든 `findByText` → `findAllByText` 교체는 원래 의도("페이지 로드 대기" 게이트)를 정확히 보존하며, production 코드 변경 없이 테스트 레드를 그린으로 복구한다. spec `5-admin-console.md`의 화면 구조(목록 행 + 상세 헤더에 인스턴스 이름 이중 노출)와 일치하며, 기능 완전성 관점에서 요구사항을 올바르게 충족한다. `저장 버튼 흐름` describe 블록 3곳의 들여쓰기 비일관성은 기능 무관 스타일 이슈이다.

## 위험도

NONE
