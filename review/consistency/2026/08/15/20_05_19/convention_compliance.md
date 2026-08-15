# 정식 규약 준수 검토 — spec/5-system/ (--impl-done)

## 검토 범위와 방법론

`_prompts/convention_compliance.md` 는 이번에도 컨텍스트 예산 초과로 `spec/5-system/` 19개
중 3개(`6-websocket-protocol.md`·`2-api-convention.md`·`3-error-handling.md`)만 본문이
실렸고 나머지 15개, `spec/conventions/` 전체(271개), 그리고 **git diff 본문조차** 예산
초과로 생략됐다. 이 turn 은 이 갭을 메우기 위해 (a) 워크트리에서 `git diff
origin/main...HEAD` 를 직접 실행해 실제 변경 범위를 확정하고, (b) 대상 파일들을 파일시스템
직독으로 확인했으며, (c) 새로 인용되는 `spec/conventions/node-output.md`(Principle 3.2/4.5/
1.1.4) 와 `spec/conventions/spec-impl-evidence.md`(frontmatter `code:` 필드 스키마)를 직접
Read 해 대조했다.

**실측 결과**: `origin/main...HEAD` 사이 `spec/**` 변경은 `spec/5-system/6-websocket-protocol.md`
**단 1줄** 뿐이다 —

```diff
 code:
   - codebase/backend/src/modules/websocket/websocket.gateway.ts
   - codebase/backend/src/modules/websocket/websocket.service.ts
+  - codebase/backend/src/modules/websocket/websocket-events.types.ts
   - codebase/backend/src/shared/utils/strip-external-only-fields.ts
```

이는 `websocket.service.ts` 에서 순환참조 해소를 위해 값·타입 정의를 별도 모듈
(`websocket-events.types.ts`, 신규)로 추출한 리팩터(`plan/in-progress/ws-event-types-extract.md`,
`spec_impact: none`)에 따라 frontmatter `code:` 목록에 그 신규 파일을 추가한 것이다. 문서
본문(§1~§9, Rationale)은 무변경이며, 직전 turn(18:53:27, `--impl-prep`)의 검토 대상과
사실상 동일하다. 본 turn 은 그 검토를 재확인 + diff 자체의 규약 준수 여부 확인 + 1건의
정정으로 보완한다.

## 발견사항

이번 diff·문서 전체를 통틀어 CRITICAL·WARNING 은 발견되지 않았다.

- **[INFO] diff 자체는 `spec-impl-evidence.md` 스키마를 정확히 따른다 (확인, 위반 아님)**
  - target 위치: `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 리스트
  - 대조 규약: `spec/conventions/spec-impl-evidence.md` §2.1(`code` 필드 = `string[]`, 레포
    루트 상대경로) / §3(`status: partial` → `code:` ≥1 매치 의무)
  - 상세: 추가된 경로 `codebase/backend/src/modules/websocket/websocket-events.types.ts` 는
    워크트리에 실재한다(`ls` 로 확인, 12,787 bytes). 파일명 접미사 `.types.ts` 는 이미
    `spec/conventions/interaction-type-registry.md`·`rag-evaluation.md`·
    `execution-context.md` 가 각각 인용하는 기존 코드베이스 패턴(`conversation-thread.types.ts`,
    `golden-set.types.ts`, `resume-call-stack.types.ts`)과 동일해 신규 네이밍 이탈이 아니다.
    `spec-code-paths.test.ts` 가드(경로 실존 검증) 통과가 예상된다.
  - 결론: 위반 없음. 참고용 확인 항목으로만 기록.

- **[INFO] 직전 turn 의 "`## Overview` 섹션 부재" INFO 는 정정이 필요 — `_product-overview.md` 존재 시 예외 조항 있음**
  - target 위치: `spec/5-system/6-websocket-protocol.md`(frontmatter 직후 `## 1. 연결`로 진입,
    `## Overview` 없음), `2-api-convention.md` 동일
  - 관련 규약: `.claude/skills/project-planner/SKILL.md` §"Spec 문서 구조 (3섹션 권장)" —
    `## Overview (제품 정의)` 행: "영역의 사용자 가치·요구사항·목표(옛 PRD 자리). **다중 spec
    파일을 가진 영역은 `_product-overview.md` 별도 파일**"
  - 상세: `spec/5-system/` 는 19개 파일을 가진 다중-spec 영역이고 `_product-overview.md` 가
    실제로 존재한다(번들 인벤토리에서 확인, 원본 9,303자). SKILL.md 문언대로면 개별 기술
    spec 파일(`6-websocket-protocol.md` 등)이 자체 `## Overview` 를 갖지 않는 것은 **디자인된
    예외이지 이탈이 아닐 수 있다** — 직전 turn(18:53:27) 이 이를 "권장 미충족" INFO 로 등재한
    것은 이 예외 조항을 충분히 반영하지 않은 판단일 수 있다.
  - 다만 같은 영역의 `1-auth.md`·`3-error-handling.md` 는 자체 `## Overview` 를 갖고 있어
    영역 내부에서도 관행이 갈린다(일부는 개별 Overview + `_product-overview.md` 병존, 일부는
    `_product-overview.md` 만 위임) — SKILL.md 자체가 이 두 관행 중 어느 쪽이 정답인지 명시하지
    않아, 이는 spec 쪽 결함이라기보다 **컨벤션 문서(SKILL.md)의 모호성**에 가깝다.
  - 제안: 차단 사유 아님(권장 수준 + 이번 diff 가 만든 상태도 아님 + 예외 조항 가능성). 후속
    `project-planner` turn 에서 SKILL.md 의 "다중 spec 파일 영역의 Overview 위임 규칙"을
    명확화하면 이 INFO 자체가 소멸할 수 있다.

- **[INFO] `6-websocket-protocol.md` §4 절 번호 중복(`### 4.4` 두 번, `4.3`이 `4.4` 뒤에 등장) — 이번 diff 와 무관한 기존 상태**
  - target 위치: `spec/5-system/6-websocket-protocol.md` L209(`### 4.2`) → L392(`### 4.4
    사용자 입력 대기 이벤트 상세`) → L738(`### 4.3 KB 문서 이벤트`) → L761(`### 4.4 알림
    이벤트`) — `git show origin/main:spec/5-system/6-websocket-protocol.md` 로 대조한 결과
    **origin/main 에도 동일하게 존재**(줄 번호만 -1, 내용 동일). 이번 PR 이 만든 상태가
    아니다.
  - 위반 규약: 명시적 규약 없음(CLAUDE.md·SKILL.md 어디에도 하위 헤딩 번호 연속성을
    강제하는 조항 없음) — "문서 구조 규약" 관점의 참고 사항으로만 기록.
  - 상세: `### 4.4 사용자 입력 대기 이벤트 상세` 가 `### 4.2` 바로 뒤, `### 4.3 KB 문서
    이벤트` 보다 앞에 물리적으로 위치해 번호와 순서가 어긋나고, `### 4.4` 헤딩이 서로 다른
    두 절(`사용자 입력 대기 상세` / `알림 이벤트`)에 중복 부여돼 있다. Markdown 앵커는 전체
    헤딩 텍스트 기반이라 실제 링크 충돌(`#44-...`)은 발생하지 않지만, 문서 내부에서 "§4.4
    참조" 라고만 지칭하는 대목(L232 등)은 두 후보 중 어느 것인지 문맥에 의존해야 한다.
  - 제안: 이번 diff 의 스코프 밖(코드는 건드리지 않았고 spec 변경은 frontmatter 1줄뿐)이므로
    본 turn 을 막을 사유 아님. 후속 spec 정리 시 `4.3`/`4.4` 재배열을 고려할 만하다는 점만
    기록.

## 요약

이번 PR 의 `spec/**` 변경은 `spec/5-system/6-websocket-protocol.md` frontmatter `code:`
목록에 신규 추출 파일(`websocket-events.types.ts`) 경로 1줄을 추가한 것이 전부이며, 이는
`spec/conventions/spec-impl-evidence.md` 의 `code:` 필드 스키마(§2.1)·`status: partial`
검증 규칙(§3)을 정확히 따른다 — 경로가 실재하고, 파일명 접미사도 기존 코드베이스 패턴과
일치한다. 문서 본문은 무변경이라 CRITICAL·WARNING 은 없다. 직전 turn(18:53:27)이 남긴 유일한
INFO(`## Overview` 부재)는 `project-planner` SKILL.md 의 "다중 spec 파일 영역은
`_product-overview.md` 로 위임 가능" 예외 조항에 비추어 실제 이탈이 아닐 가능성이 있다는
정정을 추가했고, 부수적으로 이번 diff 와 무관한 기존 절 번호 중복(`4.3`/`4.4`)을 참고용으로
기록했다. 두 항목 모두 이번 작업을 차단할 사유가 아니다. 여전히 truncated 파일
(`4-execution-engine.md`·`14-external-interaction-api.md` 등 15개 spec 파일 + `error-codes.md`·
`node-output.md`(부분 확인)·`redis-keys.md`·`swagger.md` 등 대부분의 conventions 파일)은
전문 검토 대상에서 빠졌으므로 "발견 없음"을 그 파일들의 완전한 준수 증거로 해석하지 말 것.

## 위험도

NONE
