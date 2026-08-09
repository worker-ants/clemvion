# 유지보수성(Maintainability) 리뷰

## 스코프 메모

이번 diff 는 두 `.md` 문서만 대상이다 (`review/consistency/.../rationale_continuity.md` 신규 생성, `spec/conventions/spec-impl-evidence.md` 부분 수정). 소스 코드 변경이 없으므로 함수 길이·중첩 깊이·순환 복잡도 같은 관점은 해당 없음(N/A). 아래는 문서 산문으로서의 가독성·네이밍/일관성·중복 관점만 실질적으로 적용했다.

### 발견사항

- **[INFO]** `plan-frontmatter.test.ts` 가드 설명 행이 3개의 이질적 책임(frontmatter 필드 존재, plan status enum 검증, 링크 무결성)을 한 테이블 셀에 나열
  - 위치: `spec/conventions/spec-impl-evidence.md:132` (diff 게이트 기준. 파일 원본에서는 §4.2 표, `plan-frontmatter.test.ts` 행)
  - 상세: 기존에는 "top-level `plan/in-progress/*.md` 의 frontmatter 필드 필수" 한 가지만 검증했는데, 이번 diff 로 "(1) frontmatter 필드 (2) `plan/complete/**` status enum (3) 상대링크 무결성" 셋으로 늘었다. 파일명/테스트명(`plan-frontmatter`)이 더 이상 실제 검증 범위(status 값 + 링크까지)를 정확히 나타내지 않는다. 같은 표의 `spec-link-integrity.test.ts` 행도 (1)(2) 구조라 스타일상 일관은 되지만, 한 가드가 계속 책임을 흡수하는 패턴이 반복되면 향후 가독성·SRP 부담이 커진다.
  - 제안: 지금 당장 분리를 요구할 정도는 아니나, 다음에 이 가드에 책임이 하나 더 붙는다면 파일 분리(`plan-status.test.ts` 등) 또는 표 셀을 하위 bullet 로 나누는 리팩터를 고려. 현재는 정보성 관찰.

- **[INFO]** `rationale_continuity.md` 일부 문단이 다중 중첩 괄호·인용부호로 한 문장에 여러 주장을 압축
  - 위치: `review/consistency/2026/08/10/01_37_01/rationale_continuity.md:22` (전체 파일 컨텍스트 게이트 기준, "### 1) 기각된 대안의 재도입" 하위 "개명" bullet)
  - 상세: "`plan/complete/spec-sync-5-system-metrics-gap.md:37`은 오히려 ... 뒷받침한다. 이 개명을 반대하거나 ... 충돌하지 않는다." 한 bullet 안에 근거 인용·반박·결론까지 3중 주장이 이어져 있고, 괄호 안에 또 괄호·인용부호가 중첩돼 문장 경계가 즉시 파악되지 않는다. 해당 문서는 리뷰 산출물(일회성 기록)이라 장기 유지보수 대상은 아니지만, 향후 유사 리뷰 산출물 작성 시 문장당 하나의 주장으로 쪼개면 재독성이 개선된다.
  - 제안: 필수 수정 아님(리뷰 아티팩트 특성상). 반복되는 패턴이면 리뷰어 프롬프트에 "문장당 단일 주장" 가이드를 추가하는 것도 방법.

- **[INFO]** 신규 `status:`(plan frontmatter) 도메인 구분 bullet 이 형제 bullet 대비 정보 밀도가 높음
  - 위치: `spec/conventions/spec-impl-evidence.md:87`
  - 상세: 같은 `## 2.2` 리스트의 인접 bullet(`code:` 키, 기존 `status:` 키)은 1~2문장인데 반해, 신규 bullet 은 날짜·SoT 포인터·값 공유 설명·가드 파일명 대응까지 4개 절을 한 bullet 에 담았다. 다만 `spec-link-integrity.test.ts` 행(§4.2, `2026-07-16 정정` 인용)에도 유사하게 날짜 스탬프를 인라인 서술에 포함하는 선례가 있어 파일 전체 컨벤션과 완전히 어긋나지는 않는다.
  - 제안: 선택 사항. 필요하면 "언제 추가됐는지"는 Rationale 절로 옮기고 본문 bullet 은 의미 구분만 남기는 방식도 고려 가능하나, 현재도 파일 관례와 정합적이라 강제하지 않음.

- **[INFO]** 마크다운 테이블 구조 무결성은 검증됨 — 문제 없음
  - 위치: `spec/conventions/spec-impl-evidence.md:128-134`
  - 상세: §4.2 표의 각 행이 파이프(`|`) 4개로 3열 구조를 정확히 유지(자동 검증 완료). 셀 내부 백틱·괄호가 표 파싱을 깨지 않음.
  - 제안: 조치 불필요. 참고용 기록.

### 요약

이번 diff 는 코드가 아닌 리뷰 산출물 1건(신규)과 spec 컨벤션 문서 1건(부분 수정)만 포함하므로, 함수 길이·중첩·순환 복잡도 같은 전통적 유지보수성 지표는 적용되지 않는다. 문서 산문 관점에서는 `spec-impl-evidence.md` 의 `plan-frontmatter.test.ts` 가드가 세 번째 책임(링크 무결성)까지 흡수하면서 이름-범위 정합이 조금씩 벌어지는 경향이 관찰되지만 기존 표 스타일과 일관되어 즉각적 문제는 아니고, `rationale_continuity.md` 는 일부 문장이 다중 주장을 압축해 밀도가 높으나 일회성 리뷰 기록이라 장기 유지보수 부담이 크지 않다. 두 파일 모두 기존 문서 컨벤션(날짜 인라인 표기, 표 셀 enumeration 패턴)과 스타일이 일관되어 새로운 구조적 결함은 발견되지 않았다.

### 위험도

LOW
