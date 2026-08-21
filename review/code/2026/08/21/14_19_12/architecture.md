STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 아키텍처(Architecture) Review — masked-marker-contract-7d2e14 (라운드 8, 14_19_12)

## 검토 방법

이 PR 은 이미 7라운드 코드 리뷰(`11_27_29`~`13_55_59`)를 거쳤고, architecture 관점은 라운드1
(경로 게이팅 갭 재도입, WARNING) 이후 라운드2~7 전부 발견 없음(NONE)으로 수렴했다. 과거 라운드의
"고쳤다" 서술을 그대로 신뢰하지 않고, 이번 라운드에서 현재 저장소 상태를 직접 `Read` 로
재확인했다 — `codebase/packages/masked-markers/src/index.ts`, backend
`shared/utils/sanitize-error-message.ts`, frontend `lib/utils/masked-markers.ts`, 그리고
backend/frontend 양쪽 `masked-marker-mirror-guard.ts`/`masked-marker-mirror.spec.ts`(`.test.ts`)
전문을 라인 단위로 대조했다.

## 발견사항

없음 (Critical/Warning 0건).

라운드7(`13_55_59`)이 지적했던 blockquote 파손·비정상 장문 줄(backend spec 헤더 36-37행)은
현재 소스에서 정상 줄바꿈·인용 마크업으로 반영돼 있음을 확인했다(`masked-marker-mirror.spec.ts`
헤더 전문 대조). backend/frontend 두 미러 가드의 `SOT_DIR` 접두 경계 조건도 여전히 대칭이다 —

```
backend  masked-marker-mirror-guard.ts:149  if (relPath === SOT_DIR || relPath.startsWith(`${SOT_DIR}/`)) continue;
frontend masked-marker-mirror-guard.ts:151  if (relPath === sotPrefix || relPath.startsWith(`${sotPrefix}/`)) continue;
```

`resolveScanDirs`(2단계 스캔: `codebase/<stack>/src` + `codebase/packages/<pkg>/src`)·
`SOT_SYMBOLS`(패키지 실제 export 표면에서 파생, interop 산물 필터링)도 두 파일이 로직 수준에서
동일하다.

## 설계 평가 (SOLID·결합도·레이어·패턴)

- **단일 책임**: `@workflow/masked-markers` 는 값 도메인(마커 3종·판정 함수·깊이 상한) 하나만
  소유한다. 미러 재발 감지(`masked-marker-mirror-guard.ts`)는 별도 파일로 분리돼 있고, 그
  안에서도 `resolveScanDirs`/`listSourceFiles`/`findRedeclaredSymbols`/
  `findMirrorRedeclarations` 로 스캔·파싱·판정·집계 책임이 함수 단위로 갈라져 있다.
- **의존성 역전**: backend/frontend 모두 패키지를 향해 단방향으로 의존한다
  (`backend/frontend → @workflow/masked-markers`). 역방향 참조나 순환은 없다 — 패키지
  `src/index.ts` 는 backend/frontend 어느 쪽도 import 하지 않는다.
- **개방-폐쇄**: `SOT_SYMBOLS` 를 패키지의 실제 export 표면(`Object.keys(sot)`)에서 파생시켜,
  패키지에 심볼이 추가돼도 가드 코드 수정 없이 자동으로 감시 대상에 편입된다 — 손 목록을
  파생으로 바꾼 이력(`11_53_49` W3)이 이 원칙을 정확히 겨냥한다.
- **레이어 경계**: 재발 방지 가드(`src/repo-guards/**`)는 테스트 전용이며 프로덕션 빌드에서
  제외된다(선행 라운드가 `production-build-devdep` 가드로 실측 확인). 프로덕션 코드 경로에
  개발/테스트 전용 관심사가 새지 않는다.
- **디자인 패턴**: 소비처(`sanitize-error-message.ts`/`masked-markers.ts`)는 재export shim
  패턴을 쓴다 — import 경로를 안정적으로 유지하면서(`@/lib/utils/masked-markers`) 실제 값
  소유권만 패키지로 이전했다. 값 도메인 추출 + shim 유지는 이 저장소의 기존 패턴
  (`@workflow/ai-end-reason`)과 일관된 재사용이다.
- **모듈 경계**: "SoT 는 backend 가 만들고 frontend 가 판정한다"는 계약이 이제 코드 레벨에서
  공유 패키지 하나로 명시된다 — 이전에는 이 경계가 두 스택에 각각 손으로 복제된 문서적
  약속에 불과했다.

## CI 경로 게이팅과 가드 이중화에 대한 아키텍처적 판단

이 PR 의 핵심 설계 결정(계약 테스트 대신 값 추출, 재발 감지 로직은 배포 워크플로 경로 게이팅을
피하려고 backend/frontend 양쪽에 사본을 둠)은 이례적으로 잘 문서화돼 있고, 그 트레이드오프
("값의 미러는 위험하지만 탐지 **로직**의 중복은 각 사본이 자기 트리거에서 계속 동작하므로
안전하다")를 이 PR 자신의 이력에서 실제로 반증하고(라운드3~4, 접두 경계 비대칭) 그 반증을
캐너리로 고정한 과정 전체가 소스 인접 주석에 남아 있다. 탐지 로직 자체를 공유 패키지로 재추출해
이중 유지비를 근본적으로 없애는 대안은 리뷰어(라운드6)와 developer(라운드6 RESOLUTION) 모두
동의했지만 "이 PR 의 범위를 또 넓힌다"는 이유로 후속으로 미뤄졌고, `plan/in-progress/`
후속 트래커에 등재돼 있음을 plan 문서에서 확인했다 — SoT 미등재로 유실될 위험은 없다.

## 요약

이 PR 은 backend/frontend 에 손으로 복제되던 마스킹 마커 값 도메인을 `@workflow/masked-markers`
공유 패키지로 추출하는 순수 리팩터이며, 값·마스킹 로직 자체는 8라운드 리뷰 내내 한 번도
지적되지 않았다 — 모든 아키텍처 발견은 그 이관을 지키는 재발 방지 가드 쪽에서 나왔고(경로
게이팅 갭 재도입 · 감시 목록 자체가 미러 · 스캔 범위가 전수처럼 보이지만 아님 · 완료형 서술이
거짓), 전부 이전 라운드에서 수정돼 이번 라운드 재검증에서 현재 상태와 일치함을 직접 확인했다.
SOLID 원칙 위반, 순환 의존, 레이어 경계 붕괴, 과도/부족한 추상화는 발견되지 않았다. 탐지 로직
자체의 backend/frontend 중복은 알려진 트레이드오프이고 재추출 후속 작업이 SoT(plan)에 이미
등재돼 있어 architecture 관점에서 이번 라운드 신규 차단 사유는 없다.

## 위험도
NONE
