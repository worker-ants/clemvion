# Rationale 연속성 검토 — spec-links-dedup

## 검토 대상 요약

`codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 의 순수 리팩터링. `findBrokenLinks`(spec/** 스캔)와
`findBrokenSpecLinksInSources`(codebase 소스 스캔)가 ~40줄 DEAD/ANCHOR 스캔 루프를 중복 보유하던 것을 공유 코어
`findBrokenLinksInFiles(files, options)` 로 추출했다. 두 옵션(`checkSelfAnchors`, `targetFilter`)이 두 호출부의
차이(코드 소스는 heading 이 없어 same-file anchor 미검증 / codebase 스캔은 `spec/**.md` 타깃만)를 명시적으로
보존한다. `isExternal` 스킵, DEAD/ANCHOR 판정, 정렬 로직도 동일하게 유지된다 — 실제 코드(줄 196-252, 261-265,
323-328) 를 직접 대조한 결과 두 public 함수의 관측 가능한 동작은 리팩터링 전후로 정확히 등가다.

## 이력 대조

이 작업은 새로 발견된 결정이 아니라, `plan/in-progress/eia-context-schema-followups.md` §리뷰 후속에 이미
등재돼 있던 저우선 백로그 항목 "`spec-links.ts` 중복 정리"(원문: "동작은 정확, 저우선 — 파일-목록 파라미터화한
코어로 추출 여지")를 그대로 수행한 것이다. 커밋 `829ddceee`("refactor(docs-guard): spec-link 스캔 코어를
파라미터화해 중복 제거") 메시지도 "동작 무변경 — spec-link-integrity 가드 13 tests 동일 green" 이라고 명시한다.

## 발견사항

없음 — CRITICAL/WARNING 없음.

- **[INFO]** `spec/conventions/spec-impl-evidence.md` R-6 과의 표면적 유사성은 실질 충돌이 아님
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 의 `findBrokenLinksInFiles` 추출
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md` `## Rationale` R-6 ("두 가드가 같은 키를 검증하지만
    대상 문서가 다르고 검증 강도도 다르다 ... 통합 안 함 — 같은 이름이지만 다른 invariant")
  - 상세: R-6 은 spec frontmatter `code:` 검증과 user-guide MDX `code:` 검증이라는 **서로 다른 invariant 를 가진
    두 가드**를 하나로 합치지 않기로 한 결정이다. 표면적으로 "중복 로직을 하나로 합쳤다" 는 점에서 이번 리팩터링과
    유사해 보이지만, 실제로는 원칙이 충돌하지 않는다 — 이번 변경은 `findBrokenLinks`/`findBrokenSpecLinksInSources`
    라는 **두 public 함수(=두 가드의 진입점)를 그대로 유지**하며, 각 함수가 검증하는 invariant(같은-파일 anchor
    허용 여부·타깃 필터)는 옵션 객체로 명시적으로 분리·보존된다. R-6 이 경계 삼은 것은 "가드 레벨에서 서로 다른
    도메인을 섞지 말라" 는 것이고, 이번 변경은 가드 레벨의 경계는 그대로 두고 내부 알고리즘만 파라미터화한 것이라
    R-6 의 원칙 위반이 아니다.
  - 제안: 조치 불요. 향후 유사 리팩터링 검토 시 참고할 수 있도록 기록만 남김.

## 요약

이번 변경은 `plan/in-progress/eia-context-schema-followups.md` 에 사전 등재된 저우선 DRY 정리 백로그를 그대로
수행한 순수 리팩터링이며, 커밋 메시지·코드 대조 모두 동작 무변경(behavior-preserving)임을 뒷받침한다. 어떤 spec 의
`## Rationale` 에서도 이 파일의 내부 구조(단일 함수 vs 파라미터화된 공유 함수)에 대한 명시적 결정이나 대안 기각
이력이 없고, 두 public 함수의 관측 가능한 동작(스캔 대상 파일 집합, DEAD/ANCHOR 판정, same-file anchor 처리,
`spec/**.md` 타깃 필터)은 옵션 객체를 통해 정확히 보존되어 새로운 invariant 우회나 원칙 위반이 없다. `spec-impl-
evidence.md` R-6("다른 invariant 는 통합하지 않는다")과의 표면적 유사성도 검토했으나, 이번 리팩터링은 가드 레벨
경계(두 public 함수)를 유지한 채 내부 알고리즘만 공유하므로 R-6 의 취지와 충돌하지 않는다.

## 위험도

NONE
