# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** CHANGELOG.md 에서 빈 줄 누락으로 문단이 직전 불릿 항목에 흡수된다 (Markdown lazy continuation)
  - 위치: `CHANGELOG.md:57-59`
  - 상세: `### 택한 것 — 원인은 구조로, 결과는 이름으로` 절의 `user-entity-exposure-guard.ts` 불릿(44행 시작, 들여쓰기 2칸으로 이어지는 문단이 57행 "**0건**을 계약으로 고정했다." 로 끝난다) 바로 다음 58행에 빈 줄 없이 "**이 두 축이 `User` 컬럼 방어의 전부다.** 아래 JSDoc 인용 가드는 **별개 관심사**이고, 이 브랜치에 합류한 경위는 그 절에 적었다." 가 이어 붙는다. CommonMark 의 lazy continuation 규칙상, 리스트 항목 문단 뒤에 빈 줄 없이 오는(그리고 새 블록으로 해석되지 않는) 텍스트는 **그 리스트 항목의 같은 문단**으로 흡수된다 — 즉 이 문장은 저자의 의도(두 축을 요약하는 독립 문단)와 달리 `user-entity-exposure-guard.ts` 불릿 텍스트의 일부로 렌더링된다. 같은 문서의 다른 자리(73~78행, `user-secret-absence.ts` 불릿 뒤 "**이것은 방어가 아니라 검출이다.**" 앞)는 77행에 빈 줄을 정확히 두어 독립 문단으로 렌더링되므로, 이는 문서 전체의 의도된 스타일이 아니라 이 자리만의 누락이다. 내용상으로도 "이 두 축" 은 이 시점엔 아직 첫 번째 축(`user-entity-exposure-guard.ts`)만 서술된 상태이고, 두 번째 축(`user-secret-absence.ts`)은 중간에 끼어드는 "곁가지" 절(61행) 이후 71행에서야 나온다 — 리스트에 흡수되면 "전부다" 라는 결론 문장이 첫 번째 축의 세부 사항인 것처럼 읽혀 더 혼동을 준다.
  - 제안: 58행 앞에 빈 줄을 추가해 독립 문단으로 분리한다.

- **[INFO]** `JsDocCitation.citations` 필드 주석의 "전부" 표현이 실제 수집 범위보다 넓게 읽힌다
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts` — `JsDocCitation.citations` 필드 JSDoc(`매치된 텍스트 **전부**...`) 및 `findCitations` 함수
  - 상세: `findCitations` 는 `CITATION_PATTERNS` 세 정규식 각각에 대해 `re.exec` 상당의 `RegExp.exec`(global 플래그 없음)로 **패턴당 첫 매치 하나만** 수집한다. 필드 주석의 "매치된 텍스트 **전부**" 는 문맥상 "세 형태 각각이 관측돼야 한다" 는 취지(바로 다음 문장 "한 JSDoc 에 두 형태가 섞이면… 뒤 형태가 영영 관측되지 않는다")로는 정확하지만, 문자 그대로 읽으면 "같은 형태가 한 JSDoc 안에 두 번 나타나는 경우"에도 전부 잡는 것처럼 오해할 수 있다(실제로는 그런 경우 두 번째 이후 occurrence 는 잡히지 않는다). 기능 결함은 아니고 현재 목적(세 형태 각각의 존재 확인)에는 지금 구현으로 충분하다.
  - 제안: "전부" 를 "형태별 대표 매치" 정도로 좁혀 적거나, 그대로 둘 경우 조치 불요(현재 사용 범위에서 오해가 실질적 리스크로 이어지지 않음).

## 요약

이번 diff(`User` 엔티티 컬럼 노출 방어 2축 신설, `WorkflowVersionsService.findOne` 실유출 수정, 트리거 `endpointPath` 충돌 409 계약 구현, `review_guard._parse_frontmatter_code` YAML 주석/빈 줄 파싱 결함 수정, `dto-jsdoc-citation-guard` 신설 및 `review-citations.md`/`spec-impl-evidence.md` 자기-반증 정정)는 여러 차례의 선행 리뷰 라운드를 거치며 문서화 품질이 이례적으로 높은 수준에 도달해 있다. 확인한 범위에서: (1) 신규·수정 공개 함수·타입(`pgErrorConstraint`, `CREATOR_PROJECTION`, `ProjectedCreator`, `WorkflowVersionDetail`, `findEagerUserRelations`, `collectUserRelationNames`, `findDtoJsDocCitations`, `findUserSecretLeaks` 등)에 "왜 이 방식인가"·"왜 대안을 기각했는가"를 실측 수치와 리뷰 인용(`review/code/...`, `review/consistency/...`)으로 뒷받침하는 JSDoc 이 붙어 있고 직접 대조해 정확했다(예: `tsconfig.build.json` exclude 3종, `workspace_member.joinedAt` 을 채우는 4자리, `user.entity.ts` `@Column` 23개, `CREATOR_PROJECTION` ↔ `WorkflowVersionCreatorDto` OpenAPI 스키마 일치). (2) 선행 라운드가 지적했던 e2e 시나리오 라벨 중복(`F.`)·misplaced JSDoc 블록(`findEagerUserRelations` 위)·미사용 `line` 필드는 현재 상태에서 모두 해소되어 있음을 직접 확인했다. (3) `spec/conventions/review-citations.md`·`spec-impl-evidence.md` 의 자기-반증 정정은 CLAUDE.md 가 요구하는 취소선(`~~...~~`) + "정정 (날짜)" 형식을 정확히 따른다. (4) API 계약 변경(`ApiConflictResponse` 2건)은 이미 spec(`2-trigger-list.md §3`)이 문서화한 형태를 구현으로 채운 것이라 추가 spec 갱신이 불필요함을 확인했다. 유일하게 발견한 실질적 결함은 `CHANGELOG.md` 한 자리에서 빈 줄 누락으로 인한 Markdown 렌더링 결함(리스트 항목 흡수)이며, 그 외 하나는 사소한 표현 정밀도에 대한 참고 사항이다.

## 위험도

LOW
