# 신규 식별자 충돌 검토 — `spec/5-system` (--impl-prep)

## 선행 확인 — 이 게이트가 실제로 새 식별자를 도입하는가

이번 `--impl-prep` 호출은 진행 중 plan
[`plan/in-progress/nestjs-v12-coordinated-upgrade.md`](../../../../../plan/in-progress/nestjs-v12-coordinated-upgrade.md)
에서 발생했다 (`_prompts` 번들의 "검색 대상 코퍼스" 절에 전문이 포함된 유일한
`plan/in-progress/*` 문서). frontmatter 는 `spec_impact: none` 이고, 본문(§A~E)이 서술하는
작업은 다음뿐이다:

- 막힌 dependabot PR 두 개(`@nestjs/typeorm`, `@nestjs/platform-express`)의 종착점으로,
  `@nestjs/*` 전 패키지를 v12 계열로 **동시에** 올리는 의존성 범프
- 업그레이드 전/후 `@WorkspaceId()` reflection 부트 캐너리 소비 라우트 수(142건)·3개 unit
  스위트(48/48)·mutation-based 판별자(`handlerConsumesWorkspaceId` 항상 false) 기준값 기록 및
  회귀 검증 체크리스트

요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV var·config key·spec 파일 경로 중 이 plan이
**새로 부여하거나 새로 만드는 식별자는 없다.** §C 가 인용하는 "부트 캐너리 — `@WorkspaceId()`
reflection 자가검증"은 `spec/5-system/1-auth.md`에 이미 존재하는 절이며, §C 의 근거인
`review/consistency/2026/09/24/12_57_36` `plan_coherence` W3 도 기존 문서를 가리킬 뿐 새 이름을
만들지 않는다.

실측으로 재확인했다: 현재 worktree 는 `origin/main` 대비 `spec/` 전체에서 **diff 0** 이다.

```
$ git diff origin/main --stat -- spec/5-system   →  (출력 없음)
$ git diff origin/main --stat -- spec/           →  (출력 없음)
$ grep spec_impact plan/in-progress/nestjs-v12-coordinated-upgrade.md
spec_impact: none
```

따라서 target 으로 번들된 `spec/5-system/1-auth.md` · `2-api-convention.md` ·
`3-error-handling.md`(및 컨텍스트 예산으로 생략된 나머지 14개 파일)는 **이미 기존에 커밋되어
있는 상태 그대로**이며, 이 plan 이 새로 부여하는 요구사항 ID·엔티티명·endpoint·이벤트명·ENV
var·설정키·파일 경로는 존재하지 않는다. "target 문서가 도입하는 새 식별자" 라는 이 검토 관점의
전제 자체가 이번 실행에는 성립하지 않는다 — 직전 실행(`review/consistency/2026/09/24/12_57_36`,
`jest-esm-native-load.md` 대상)과 동일한 패턴이다.

## 관점별 점검 (참고용 — 신규 도입 없음을 재확인)

1. **요구사항 ID** — NestJS 12 패키지 범프는 요구사항 ID 를 신설하지 않는다. 대상 없음.
2. **엔티티/타입명** — 신설 엔티티·DTO·인터페이스 없음. `@nestjs/*` 는 서드파티 프레임워크
   패키지명이며 이 저장소의 도메인 식별자 네임스페이스와 겹칠 여지가 없다.
3. **API endpoint** — 신설 endpoint 없음. §D 가 언급하는 "Swagger·socket.io 어댑터의 v12 API
   변경"은 기존 어댑터 초기화 코드의 시그니처 변경 가능성을 예상한 것이지, 새 REST/WS
   endpoint 를 만드는 것이 아니다.
4. **이벤트/메시지명** — 신설 없음. 대상 없음.
5. **환경변수·설정키** — plan 본문 전체에 신규 ENV var·config key 도입 서술이 없다.
   `@nestjs/config@12` 로의 버전 범프 자체는 기존 config 키 이름에 영향을 주지 않으며, plan 도
   그런 변경을 계획하지 않는다.
6. **파일 경로** — 신규 spec 파일을 만들지 않는다. `spec/5-system` 명명 컨벤션(숫자 접두사
   순번)에 대한 영향 없음. plan 파일 자신의 경로(`plan/in-progress/nestjs-v12-coordinated-
   upgrade.md`)도 `plan/in-progress/*.md` 관례를 따른다.

## 발견사항

없음.

## 요약

이번 `--impl-prep` 실행이 겨냥한 실제 작업(`plan/in-progress/nestjs-v12-coordinated-upgrade.md`)은
`spec_impact: none`이 명시된 순수 의존성 버전 범프(`@nestjs/*` 전 패키지 v12 동시 승격)와 그
회귀 검증 체크리스트이며, 실측상 `spec/`(및 `spec/5-system`)은 `origin/main` 대비 변경이 전혀
없다. "신규 식별자 충돌" 검토가 전제하는 "target 이 새로 도입하는 식별자"가 이번 스코프에는
존재하지 않으므로, 6개 관점 모두에서 점검 대상이 없고 충돌도 없다. 직전 게이트 실행(jest-esm
plan 대상, `12_57_36`)이 남긴 "plan 체크리스트의 스코프 지정이 실제 변경 범위와 불일치한다"는
관찰이 이번에도 반복된다 — `spec/5-system` 이 scope 로 지정된 이유는 이 upgrade 가 백엔드
전반(인증 가드·reflection 등)에 걸친 런타임 회귀 위험을 지니기 때문으로 보이나, spec 문서
자체는 건드리지 않으므로 이 checker 의 관측 대상은 비어 있다.

## 위험도

NONE
