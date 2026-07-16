# 정식 규약 준수 검토

## 발견사항

- **[CRITICAL]** Target 문서 payload 자체가 손상되어 정식 규약 준수 분석 불가
  - target 위치: `_prompts/convention_compliance.md` 의 "## Target 문서" 절 (`경로:` 필드) 및 "### 구현 대상 영역:" 헤더
  - 위반 규약: `.claude/docs/subagent-call-contract.md` §2 "수행 절차" — "1. `prompt_file` 을 Read. 2. 파일의 '점검 관점' + 자신의 definition 본문 적용해 분석." 분석 대상이 유효한 단일 문서(경로)여야 이 절차가 성립하는데, 본 페이로드는 그 전제를 깨뜨린다.
  - 상세: `경로:` 필드 값이 `spec/2-navigation — 사용자 가이드(/docs) 사이드바 링크가 buildWorkspaceHref 로 /w/<slug>/docs 를 만들어 catch-all 무한 중첩 루프 발생. 수정 계획: (1) sidebar.tsx navItems 에 workspaceScoped 플래그 도입해 /docs 는 bare href 사용 (2) (main)/[...rest]/page.tsx catch-all 을 terminal 로 — rest[0]=='w' 이면 prefix 재부착 금지, /w/<slug> 단독은 dashboard forward, 그 외는 notFound() (3) buildWorkspaceHref idempotent 화는 미채택. 관련 spec: spec/2-navigation/_layout.md:85, spec/2-navigation/9-user-profile.md:155-158` 전체다. 이는 파일 경로가 아니라, plan 의 "구현 대상 영역" 제목(`spec/2-navigation`)과 그 뒤에 em-dash(` — `)로 이어졌을 scope 설명 문장이 통째로 하나의 경로 토큰에 병합된 형태다. 뒤이은 코드 블록의 "Target 문서 내용" 도 `(없음)` 으로 표기되어, 실제로는 어떤 문서 본문도 로드되지 않았다. 결과적으로 이 checker 는 명명·출력 포맷·문서 구조 등 어떤 관점도 특정 문서의 실제 텍스트에 대해 라인 단위로 검증할 수 없는 상태다 — 이는 target 문서의 규약 위반이 아니라, 이 호출을 만든 orchestrator 스크립트가 payload 템플릿에 plan 요약/scope 문자열을 경로 필드로 잘못 주입한 **상위 tooling 결함**이다.
  - 제안: orchestrator 측에서 `경로:` 필드는 실제 spec 파일 경로(예: `spec/2-navigation/_layout.md`, `spec/2-navigation/9-user-profile.md`, `spec/2-navigation/13-user-guide.md` 중 이번 버그 수정이 참조하는 문서들, 혹은 영역 전체 스캔이면 `spec/2-navigation/**`)만 담고, plan 요약/scope 설명은 별도의 "검토 모드"/컨텍스트 필드로 분리해 재생성 후 재호출 필요. (본 checker 는 payload 를 임의로 재해석해 재작성할 권한이 없음 — orchestrator 재실행 필요.)

## Best-effort 보충 확인 (target 미제공에 대한 완화 조치)

Payload 가 손상되었으나 "관련 spec" 으로 명시된 두 좌표(`spec/2-navigation/_layout.md:85`, `spec/2-navigation/9-user-profile.md:155-158`)와 연관 문서 `spec/2-navigation/13-user-guide.md` 를 직접 Read 해 최소한의 정식 규약 준수를 확인했다:

- **명명 규약**: `_layout.md`(밑줄 prefix, layout/index 성격), `9-user-profile.md`/`13-user-guide.md`(`N-name.md` 상세 spec), `_product-overview.md` 존재 — 모두 [`project-planner/SKILL.md` "명명 컨벤션"](../../../../../.claude/skills/project-planner/SKILL.md) 및 [`spec-impl-evidence.md` §1](../../../../../spec/conventions/spec-impl-evidence.md#1-적용-대상) 과 일치. `id`/`status`/`code` frontmatter 도 3개 파일 모두 구비(§2 스키마 준수).
  - target 위치: `spec/2-navigation/_layout.md:1-8`, `spec/2-navigation/9-user-profile.md` frontmatter, `spec/2-navigation/13-user-guide.md:1-15`
  - 위반 규약: 없음 (준수 확인)
- **문서 구조 규약**: 세 문서 모두 개별 `## Overview` 섹션은 없으나, `spec/2-navigation/_product-overview.md` 가 별도 존재하므로 "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일" 규칙([`project-planner/SKILL.md`](../../../../../.claude/skills/project-planner/SKILL.md) "Spec 문서 구조") 에 부합한다. `13-user-guide.md` 는 `## Rationale` 섹션(R-1)을 보유, `_layout.md` 도 `## Rationale`(R-1, R-2) 보유 — 규약 준수.
  - 위반 규약: 없음
- **내용 정합**: `_layout.md:85` 는 "**예외 — User Guide(`/docs`)는 워크스페이스 무관 콘텐츠라 slug 밖으로 유지**" 를 이미 명시하고, `9-user-profile.md:158` 도 "**slug 밖 유지**: 유저 가이드(`/docs`, 워크스페이스 무관 콘텐츠)" 로 일치된 invariant 를 갖고 있다. 즉 버그 수정 계획이 복원하려는 동작은 이미 spec 이 규정한 그대로이며, 이번 impl-prep 대상은 spec 문서 자체의 개정이 아니라 코드(구현)가 기존 spec invariant 에서 이탈한 것을 바로잡는 작업으로 읽힌다 — 이 경우 정식 규약 준수 관점에서는 spec 문서 쪽 위반 사항이 없다.
  - 위반 규약: 없음 (참고용 확인)

> 위 보충 확인은 payload 누락을 메우기 위한 **추정 기반 최선노력**이며, orchestrator 가 의도한 실제 target 문서가 다를 경우 이 섹션의 커버리지는 무효할 수 있다. 정식 재검토는 payload 수정 후 재실행이 필요하다.

## 요약

이번 호출의 payload(`경로:` 필드)가 손상되어 실제 target 문서 본문이 전달되지 않았다(`Target 문서 내용: (없음)`) — 이는 target 문서 자체의 정식 규약 위반이 아니라 이 checker 호출을 생성한 orchestrator 스크립트의 템플릿 결함(plan scope 설명 문자열이 경로 필드에 잘못 병합)이다. 이 결함이 이번 검토의 핵심(그리고 유일한) CRITICAL 항목이며, 재현 가능한 payload 로 재호출하기 전까지는 명명·출력 포맷·문서 구조·API 문서·금지 항목에 대한 신뢰할 수 있는 라인 단위 검증을 제공할 수 없다. 참고로 plan 이 언급한 두 좌표(`_layout.md:85`, `9-user-profile.md:155-158`)와 `13-user-guide.md` 를 best-effort 로 직접 확인한 결과, 세 문서는 명명·frontmatter·구조(Overview 위임/Rationale) 규약을 모두 준수하고 있었고, 이번 버그가 고치려는 동작(`/docs` 를 workspace slug 밖으로 유지)도 이미 spec 이 규정한 내용과 일치해 spec 문서 측 규약 위반은 발견되지 않았다.

## 위험도

MEDIUM
