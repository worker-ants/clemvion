# 정식 규약 준수 검토 — spec/5-system/

## 검토 조건 요약

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- **scope 델타: 0개 파일** — 이 브랜치(`user-entity-column-defense`)는 `spec/5-system/` 을 변경하지 않았다. 이는 정상이며 (코드 전용 PR), 델타 0 자체를 근거로 CRITICAL 을 내지 않는다(프롬프트 명시 지침 준수).
- 구현 diff 본문(11개 파일 / 1073줄)은 프롬프트 예산 절단으로 미첨부. 본 checker 의 역할은 **spec 문서의 정식 규약 준수**이며 코드-레벨 계약(응답 vs DTO 선언 등)은 별도 전문 검증자(`response-contract`, `swagger-dto-contract-guard`)의 관할이므로, 본 리뷰는 diff 원문 없이도 수행 가능한 범위(= spec/5-system 문서 자체의 conventions 준수)에 집중했다.
- `spec/conventions/**` 번들도 프롬프트 예산으로 전량 누락되어(274개 컨벤션 파일 전부 "생략됨" 표기), 워킹트리 절대경로에서 `spec/conventions/error-codes.md`·`node-output.md`·`swagger.md` 를 직접 Read 해 대조했다(alt: `/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense/spec/conventions/*.md`).

## 검증 방법

`spec/5-system/1-auth.md`(전문) · `2-api-convention.md`(전문) · `3-error-handling.md`(부분)를 실제 `spec/conventions/*.md` 원문과 절 번호 단위로 대조했다:

| 대상 인용 | 검증 대상 절 | 결과 |
|---|---|---|
| `1-auth.md` §1.5.4 "historical-artifact 예외" — `invitation_*`/`forbidden`/`rate_limited` lowercase | `error-codes.md` §3 레지스트리 | 일치 (등재 확인, "초대 API 한정" 문구까지 일치) |
| `1-auth.md` §2.3 note — `INVALID_PASSWORD` 2026-09-02 은퇴 | `error-codes.md` §5 Rename 이력 | 일치 (등급 B, 조건별 2종 분리 서술 일치) |
| `1-auth.md` §1.4.4 등 `output.error` 표준 형태 인용 | `node-output.md` §3.2 | 절 번호 존재·일치 |
| `2-api-convention.md` §5.4 — `swagger.md` §1-3/§2-5/§5-1/§6 인용 | `swagger.md` 해당 절 | 전부 절 번호 일치 (Optional 필드/응답 wrapping/응답 DTO 위치/레거시 패턴 제거) |

전수는 아니지만 인용 밀도가 가장 높은 절들을 표본 검증했으며, 전부 착지했다(참조 붕괴·오기 없음).

## 발견사항

- **[INFO]** `## Overview` 제목 표기 불일치
  - target 위치: `spec/5-system/2-api-convention.md` L971 `## Overview (제품 정의)`
  - 위반 규약: CLAUDE.md 의 "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 명명 관례 — 형식적 강제는 아니나 동일 폴더 문서들(`1-auth.md` L78, `3-error-handling.md` L1497)은 모두 순수 `## Overview` 를 쓴다.
  - 상세: `2-api-convention.md` 만 `(제품 정의)` 접미를 달아 표기가 갈린다. 기능적 문제는 없으나 동일 디렉터리 내 3섹션 헤더 표기의 시각적 일관성이 떨어진다.
  - 제안: 이번 PR 범위(`spec/5-system` 델타 0)와 무관한 기존 표기이므로 지금 당장 고칠 필요는 없다. 다음에 `2-api-convention.md` 를 편집할 기회가 있으면 `## Overview` 로 정리 — 새 항목으로 만들 필요는 없음(cosmetic, 우선순위 낮음).

- **[INFO]** `spec/conventions/**` 명칭을 쓰는 시스템 스펙 문서가 `spec/5-system/` 에 위치
  - target 위치: `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md` (파일명 자체가 "convention"·"handling policy")
  - 위반 규약: CLAUDE.md 정보 저장 위치표 — "정식 규약 → `spec/conventions/<name>.md`"
  - 상세: 이 두 문서는 이름과 내용상 "API 컨벤션"·"에러 처리 정책"이라는 규약적 성격을 갖지만 `spec/conventions/` 가 아닌 `spec/5-system/`(시스템 스펙 영역)에 있다. 다만 실제로는 `spec/conventions/error-codes.md`·`swagger.md`·`node-output.md`·`audit-actions.md` 등 **좁은 범위의 명명·카탈로그 규약**과, `spec/5-system/2-api-convention.md`·`3-error-handling.md` 같은 **시스템 전체 계약 spec**이 이미 명확히 역할 분담되어 있고(전자→규약 SoT, 후자→그 규약을 인용해 시스템 계약을 정의), 상호 참조("SoT 는 conventions/error-codes.md")도 정확하다. 즉 이는 이 리포지토리에서 오래 정착된 **의도된 구조**로 보이며, 이번 PR 이 만든 신규 드리프트가 아니다.
  - 제안: 새로 지적할 사항은 아님(정보 제공 목적). 향후 `spec/conventions/` vs `spec/<영역>/` 배치 기준을 명문화하고 싶다면 별도 project-planner 턴에서 판단할 사안이지, 본 impl-done 리뷰의 차단 사유는 아니다.

이 외에 명명 규약(§1.5.4 historical-artifact 예외 등재), 출력 포맷 규약(§5 응답 형식·§5.4 null vs 키 생략), 문서 구조 규약(Overview/본문/Rationale 3섹션, `_product-overview.md` 참조), API 문서 규약(swagger.md 절 인용) 관점에서 **conventions 직접 위반은 발견되지 않았다**. 특히 lower_snake_case 초대 에러 코드처럼 규약(UPPER_SNAKE_CASE)에서 벗어난 표기는 전부 `error-codes.md §3` historical-artifact 레지스트리에 등재된 상태로, "규약 위반의 방치"가 아니라 "규약이 정한 예외 처리 절차"를 정확히 따르고 있다.

## 요약

이번 PR 은 `spec/5-system/` 을 변경하지 않았다(diff 0). 검토 대상 문서(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)를 `spec/conventions/error-codes.md`·`node-output.md`·`swagger.md` 원문과 절 단위로 대조한 결과, 인용된 모든 규약 참조(§ 번호·레지스트리 등재 여부)가 정확히 착지했고 명명 예외(lowercase 초대 코드, `INVALID_PASSWORD` retire 등)도 정식 레지스트리 절차를 따라 문서화되어 있다. 새로 도입된 conventions 위반은 없으며, 발견된 것은 사소한 표기 일관성(Overview 제목 접미사) 수준의 INFO 2건뿐이다. 이는 이번 PR 이 유발한 문제가 아니라 기존 문서의 오래된 상태이므로 차단 사유가 아니다.

## 위험도
LOW
