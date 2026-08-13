# 정식 규약 준수 검토 — `plan/in-progress/backend-lint-gate-broken-on-main.md`

## 검토 범위 설명

target 은 `spec/**` 문서가 아니라 **`plan/in-progress/**` 작업 추적 문서**다. 점검 관점 1~5(명명·출력 포맷·문서 구조·API 문서·금지 항목)는 본래 API·spec 산출물을 겨냥한 것이라 이 문서 유형에는 적용면이 좁다. 아래는 그 좁은 교집합에서 실제로 대조 가능했던 항목만 다룬다.

추가로 밝혀둘 제약: 이번 호출에 번들된 `spec/conventions/**` 중 `error-codes.md`·`swagger.md`·`spec-impl-evidence.md`·`node-output.md`·`execution-context.md`·`interaction-type-registry.md`·`migrations.md`·`conversation-thread.md` 등 다수가 **컨텍스트 예산 초과로 본문이 절단**되어 있었다(각 파일에 "본문 생략됨" 표시). 이 때문에 출력 포맷 규약(§2)·API 문서 규약(§4) 관점의 전수 대조는 제한적이며, target 이 실제로 그 규약들과 접점을 만드는 서술이 없었으므로 결과에 실질적 영향은 없었다.

## 발견사항

- **[INFO]** 부정확한 규약 절 인용
  - target 위치: "신설 `backend unit` 게이트가 첫 실행에서 찾은 것" 절, "**원인 확정**" 항목 — `취소 경로(`node-cancellation.md` §parallel-p2 A+H)에 버그가 있는 것이 아니다.`
  - 위반 규약: `spec/conventions/node-cancellation.md` (전문 확인 결과 `§1`~`§6`+`Rationale` 만 존재, `§parallel-p2` 라는 절 표제 없음)
  - 상세: `node-cancellation.md` 본문에는 "parallel-p2 결정 A" / "(parallel-p2 결정 H)" 가 **다른 문서**(`plan/complete/parallel-p2-followups.md`)를 향한 참조로만 등장하고, `node-cancellation.md` 자신의 섹션 이름이 아니다. target 의 `§parallel-p2 A+H` 표기는 마치 그런 절이 `node-cancellation.md` 안에 있는 것처럼 읽혀, 나중에 그 앵커를 직접 찾으려는 독자를 헷갈리게 할 수 있다.
  - 제안: `node-cancellation.md`(취소 분류 규약 자체) 와 `parallel-p2-followups.md`(결정 A/H 원문)를 분리해 인용하거나, `node-cancellation.md §2.3/§5` + `parallel-p2-followups.md 결정 A·H` 식으로 정정. 사소한 표기 문제이므로 이 plan 이 다음에 편집될 때 함께 고치는 정도로 충분하다.

- **[INFO]** target 이 직접 참조한 `spec/conventions/secret-store.md §2.1` 각주(`deleteByPrefix` LIKE 메타문자 거부 invariant) 는 번들된 convention 원문과 **완전히 정합** — 새 발견 아님, 확인 결과만 기록. 같은 절에서 언급된 DIP 인터페이스 v1 면제·URI Scheme(`secret://<scope>/<resourceId>/<name>`) 사용 패턴(`secret://triggers/{triggerId}/...`)도 규약과 일치한다.

- CRITICAL/WARNING 급 위반은 발견되지 않았다. 특히 다음은 규약 준수 관점에서 **양호한 패턴**으로 확인됨(발견사항이 아니라 참고로 기록):
  - frontmatter(`worktree`/`started`/`owner` 필수 3필드 + 허용된 추가 필드)가 `.claude/docs/plan-lifecycle.md` §4 스키마와 일치.
  - `## Overview` … `## Rationale` 구조를 갖춰 CLAUDE.md 가 promote 하는 3섹션 관례(원래 spec 문서 대상)를 plan 문서임에도 자발적으로 따르고 있음.
  - `spec/` 쓰기가 developer 권한 밖임을 여러 항목에서 명시적으로 인지하고 planner 인계로 분리(`CLAUDE.md` §Skill 체계 준수), spec→plan/in-progress 상대링크를 피하고 서술로 남겨 `spec-link-integrity` 파손을 사전 회피.
  - `review/consistency/**`·`review/code/**` 산출물 경로를 `<YYYY>/<MM>/<DD>/<hh_mm_ss>/` nested-ISO 패턴대로 일관 인용.
  - 문서 안에 이미 존재하는 convention_compliance 성격의 미해결 항목(EIA 계열 Redis 키가 `4-execution-engine.md §9.1/§9.2` 레지스트리에 미등재)을 은폐하지 않고 체크되지 않은 상태(`[ ]`)로 정직하게 유지 — plan-lifecycle.md §2 의 "미해결 항목이 하나라도 있으면 in-progress 유지" 원칙에도 부합.

## 요약

target 은 정식 규약(`spec/conventions/**`)을 만드는 문서가 아니라 그것을 소비·인용하는 작업 로그이며, 점검 관점(명명/출력 포맷/문서 구조/API 문서 규약/금지 항목)이 정면으로 맞물리는 지점이 거의 없다. 유일하게 직접 인용한 `spec/conventions/secret-store.md §2.1` 은 번들 원문과 정합하고, `node-cancellation.md` 인용 하나만 존재하지 않는 절 이름(`§parallel-p2`)을 쓴 사소한 표기 부정확이다. 그 외에는 오히려 spec 쓰기 권한 분리, spec-link-integrity 회피, plan frontmatter 스키마 준수 등 규약을 의식적으로 지키는 서술이 반복적으로 확인됐다. CRITICAL·WARNING 급 위반 없음.

## 위험도

NONE
