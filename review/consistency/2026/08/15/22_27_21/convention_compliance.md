# 정식 규약 준수 검토 — spec/5-system/ (--impl-done)

## 검토 범위와 방법론

`_prompts/convention_compliance.md` 는 이번 turn 에서도 컨텍스트 예산 초과로 `spec/5-system/`
19개 중 3개(`6-websocket-protocol.md`·`2-api-convention.md`·`3-error-handling.md`)만 본문이
실렸고, 나머지 15개, `spec/conventions/` 전체(271개 — `node-output.md`·`error-codes.md`·
`redis-keys.md`·`swagger.md`·`spec-impl-evidence.md` 등 포함), 그리고 **git diff 본문**까지
예산 초과로 프롬프트에서 생략됐다. 이 갭을 메우기 위해 워크트리에서 직접
`git diff origin/main...HEAD`(및 `--stat -- spec/`)를 실행해 실제 변경 범위를 확정하고,
`spec-impl-evidence.md`·`node-output.md`·`error-codes.md`·`redis-keys.md` 를 파일시스템에서
직접 Read 해 대조했다.

**실측 결과**: `origin/main...HEAD` 사이 `spec/**` 변경은 여전히
`spec/5-system/6-websocket-protocol.md` **단 1줄**뿐이다 —

```diff
 code:
   - codebase/backend/src/modules/websocket/websocket.gateway.ts
   - codebase/backend/src/modules/websocket/websocket.service.ts
+  - codebase/backend/src/modules/websocket/websocket-events.types.ts
   - codebase/backend/src/shared/utils/strip-external-only-fields.ts
```

이는 `websocket.service.ts` 순환참조 해소를 위해 값·타입 정의를 별도 모듈
(`websocket-events.types.ts`, 신규)로 추출한 리팩터에 따라 frontmatter `code:` 목록에 그
신규 파일을 추가한 것이다. 문서 본문(§1~§9, Rationale)은 무변경이다. 동일 세션 안에서 이미
2회(18:53:27 `--impl-prep`, 20:05:19 `--impl-done`) 같은 스코프로 검토됐고, 그 사이 spec
변경이 없었으므로 이번 turn 은 **재확인**의 성격이다.

## 발견사항

이번 diff·번들된 문서 전체를 통틀어 CRITICAL·WARNING 은 발견되지 않았다.

- **[INFO] diff 자체는 `spec-impl-evidence.md` 스키마를 정확히 따른다 (확인, 위반 아님)**
  - target 위치: `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 리스트
  - 대조 규약: `spec/conventions/spec-impl-evidence.md` §2.1(`code` 필드 = `string[]`, 레포
    루트 상대경로) / §3(`status: partial` → `code:` ≥1 매치 의무)
  - 상세: 추가된 경로 `codebase/backend/src/modules/websocket/websocket-events.types.ts` 는
    워크트리에 실재한다(`ls` 로 재확인, 12,787 bytes, `git log` 상 `aedea7d63`/`65da1a9d7`
    커밋에서 도입·수정). 파일명 접미사 `.types.ts` 는 `spec/conventions/execution-context.md`
    (`resume-call-stack.types.ts`)·`interaction-type-registry.md`
    (`conversation-thread.types.ts`)·`rag-evaluation.md`(`golden-set.types.ts`)가 이미
    인용하는 기존 코드베이스 네이밍 패턴과 동일해 신규 이탈이 아니다. `spec-code-paths.test.ts`
    가드(경로 실존 검증) 통과가 예상된다.
  - 결론: 위반 없음.

- **[INFO] `## Overview` 섹션 부재는 다중 spec 영역의 설계된 예외로 판정 (이탈 아님)**
  - target 위치: `spec/5-system/6-websocket-protocol.md`(frontmatter 직후 `## 1. 연결`로
    진입, `## Overview` 없음), `2-api-convention.md` 동일. 반면 `3-error-handling.md` 는
    자체 `## Overview` 를 보유.
  - 관련 규약: `.claude/skills/project-planner/SKILL.md` "Spec 문서 구조 (3섹션 권장)" —
    `## Overview` 행: "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일"
  - 상세: `spec/5-system/` 는 19개 파일을 가진 다중-spec 영역이고 `_product-overview.md`
    가 실제로 존재한다. SKILL.md 문언상 개별 기술 spec 파일이 자체 `## Overview` 를 갖지
    않는 것은 설계된 예외다. 다만 같은 영역 안에서도 `error-handling.md` 는 문서 자체 범위
    소개용 `## Overview` 를 병존시켜, 규약(SKILL.md)이 "개별 파일 Overview 허용 여부"를
    명시적으로 확정하지 않는 모호함은 여전히 남아 있다 — 이는 target 문서의 결함이 아니라
    규약 문서 쪽의 모호성이다.
  - 제안: 차단 사유 아님. 후속 `project-planner` turn 에서 SKILL.md 의 "다중 spec 파일
    영역의 개별-파일 Overview 허용 여부"를 명확화하면 이 INFO 자체가 소멸한다.

- **[INFO] `6-websocket-protocol.md` §4 절 번호 중복(`### 4.4` 두 번, `4.3`이 `4.4` 뒤에
  등장) — 이번 diff 와 무관한 기존 상태, 재확인**
  - target 위치: `### 4.2`(L254) → `### 4.4 사용자 입력 대기 이벤트 상세`(L437) →
    `### 4.3 KB 문서 이벤트`(L783) → `### 4.4 알림 이벤트`(L806)
  - 위반 규약: 명시적 규약 없음(하위 헤딩 번호 연속성을 강제하는 조항 없음) — "문서 구조
    규약" 관점의 참고 사항.
  - 상세: `git diff origin/main...HEAD -- spec/5-system/6-websocket-protocol.md` 로
    재확인한 결과 이번 PR 이 만든 diff 는 frontmatter 1줄뿐이라 이 번호 중복은 origin/main
    에도 동일하게 존재하는 기존 상태다. 문서 내부에서 "§4.4 참조"로만 지칭하는 대목(예:
    `execution.node.cancelled` 행)은 두 후보 중 어느 것인지 문맥에 의존해야 하나, 실제
    Markdown 앵커(전체 헤딩 텍스트 기반, `#44-사용자-입력-대기-이벤트-상세` vs
    `#44-알림-이벤트`)는 서로 달라 링크 충돌은 없다.
  - 제안: 이번 turn 을 막을 사유 아님(diff 스코프 밖). 후속 spec 정리 시 `4.3`/`4.4`
    재배열을 고려할 만하다는 점만 재기록.

## 요약

이번 PR 의 `spec/**` 변경은 `spec/5-system/6-websocket-protocol.md` frontmatter `code:`
목록에 신규 추출 파일(`websocket-events.types.ts`) 경로 1줄을 추가한 것이 전부이며, 이는
`spec/conventions/spec-impl-evidence.md` 의 `code:` 필드 스키마(§2.1)·`status: partial`
검증 규칙(§3)을 정확히 따른다 — 경로가 실재하고, 파일명 접미사도 기존 코드베이스 네이밍
패턴(`*.types.ts`)과 일치한다. 문서 본문은 무변경이라 CRITICAL·WARNING 은 없다. 동일 세션
내 2차례 선행 검토(18:53:27, 20:05:19)와 결론이 동일하며, 그 사이 `spec/**` 변경이 없었음을
`git diff --stat` 으로 재확인했다. `## Overview` 부재는 다중 spec 영역 예외 조항에 해당해
이탈이 아니고, `4.3`/`4.4` 번호 중복은 이번 diff 와 무관한 기존 상태다. 여전히 truncated
파일(`4-execution-engine.md`·`14-external-interaction-api.md` 등 15개 spec 파일과
`node-output.md`·`error-codes.md`·`redis-keys.md`·`swagger.md` 등 대부분의 conventions
파일 — 이번 turn 에 필요한 항목만 발췌 확인)은 전문 검토 대상에서 빠졌으므로 "발견 없음"을
그 파일들의 완전한 준수 증거로 해석하지 말 것.

## 위험도

NONE
