# 요구사항(Requirement) Review

## 검토 범위 메모

이번 diff(22개 파일)는 실질적으로 두 축으로 나뉜다:
1. **실제 코드 변경**: `hooks.controller.ts`, `hooks.controller.spec.ts` (embed-config Cache-Control TTL 값을 `EMBED_CONFIG_CACHE_SEC` 단일 상수에서 파생시키는 behavior-preserving DRY 리팩터 + 테스트 단언 강화)
2. **프로세스 산출물 영속화**: `plan/in-progress/hooks-embed-config-cache-ttl-doc-sot.md` + 이전 `/ai-review`(12_36_04)·`/consistency-check`(12_56_04) 세션의 SUMMARY/RESOLUTION/개별 리뷰어 output·meta/`_retry_state` 파일 19개. 이들은 이미 완료된 리뷰 세션의 기록을 커밋하는 것으로, 신규 실행 로직이 아니다.

기능 요구사항 관점에서는 (1)이 핵심 검토 대상이며, (2)는 그 산출물이 실제 diff·git 이력과 일치하는지(내용의 진실성)만 대조했다.

## 발견사항

- **[INFO]** Cache-Control 값 파생 계산이 spec 명시값과 정확히 일치 — 실측 재확인
  - 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts:40-44`
  - 상세: `EMBED_CONFIG_CACHE_SEC = 300` → `EMBED_CONFIG_CACHE_CONTROL = 'public, max-age=300'`, `EMBED_CONFIG_CACHE_MAX_MINUTES = Math.ceil(300/60) = 5`. `spec/7-channel-web-chat/4-security.md:112`(`Cache-Control: public, max-age=300`, "최대 5분 반영") 및 `spec/2-navigation/9-user-profile.md:249`(`Cache-Control: max-age=300`, "최대 5분")를 직접 grep 으로 재확인한 결과 line-level 로 정확히 일치한다. 300 은 60 으로 나누어떨어지므로 `Math.ceil` 의 반올림 엣지 케이스(예: 290초→5분으로 착시)도 현재 값에서는 발생하지 않는다.
  - 제안: 없음(확인 완료).

- **[INFO]** 테스트가 정확값으로 강화되어 리팩터의 회귀 가드 목적을 달성
  - 위치: `codebase/backend/src/modules/hooks/hooks.controller.spec.ts:56-60`
  - 상세: `expect.stringContaining('max-age')` → `'public, max-age=300'` 정확값 단언으로 변경. 이전 리뷰 세션(12_36_04)의 testing 리뷰어가 지적한 "SoT 회귀 미포착" 갭이 실제로 해소됐음을 diff 로 직접 확인. 나머지 두 테스트 케이스(`interactionHttpResponse` 분기, TransformInterceptor 위임 분기)는 이번 diff 로 변경되지 않았으며 기존 로직·반환값 검증을 그대로 유지한다.
  - 제안: 없음.

- **[INFO]** WARNING 2건(선행 ai-review)이 실제로 코드에 반영됨 — RESOLUTION.md 주장과 워킹트리 상태 대조 확인
  - 위치: `hooks.controller.ts:44`(`EMBED_CONFIG_CACHE_MAX_MINUTES`, `_MIN`→`_MINUTES` 개명), `:89`(인라인 주석이 리터럴 `5분` 대신 `EMBED_CONFIG_CACHE_SEC 초` 상수명 지목으로 교체)
  - 상세: `review/code/2026/07/12/12_36_04/RESOLUTION.md`가 주장하는 두 조치(네이밍 개명, 주석 리터럴 제거)를 실제 파일과 대조한 결과 모두 반영되어 있다. `git log --oneline`으로 `0d47e3b3f`(최초 리팩터) → `ed4f4365a`(WARNING 반영) → `e4081ff9f`(consistency-check 기록) 3개 커밋이 plan 체크리스트 서술과 순서·내용 모두 일치함을 확인.
  - 제안: 없음.

- **[INFO]** TODO/FIXME/HACK/XXX 없음, 반환값·에러 경로 영향 없음
  - 위치: 변경 파일 전체
  - 상세: 순수 상수 파생 + 문자열 참조 치환이며 신규 분기·에러 처리·엣지 케이스 도입이 없다. `getEmbedConfig`/`receiveWebhook` 의 시그니처·반환 타입·fail-open 정책은 diff 대상 밖.
  - 제안: 없음.

- **[INFO]** plan 체크리스트 미완료 2건은 정상적인 진행 중 상태(결함 아님)
  - 위치: `plan/in-progress/hooks-embed-config-cache-ttl-doc-sot.md:45-46`
  - 상세: `fresh /ai-review`, `plan complete 이동` 이 미체크 상태인데, 본 리뷰 세션(13_04_46)이 바로 그 "fresh /ai-review" 단계에 해당하므로 시점상 정합적이다. `plan complete 이동`은 이 리뷰 결과가 clean 으로 확정된 이후 수행될 후속 단계로, 이번 diff 범위의 결함이 아니다.
  - 제안: 없음(리뷰 완료 후 plan 이동은 워크플로 후속 단계).

- **[INFO]** 프로세스 산출물(파일 4~22) 커밋은 CLAUDE.md 규약("review/ 는 gitignored 아님, SUMMARY·RESOLUTION 도 커밋") 및 사용자 메모리("disk-write gap → journal.jsonl 복구") 패턴과 일치
  - 위치: `review/code/2026/07/12/12_36_04/**`, `review/consistency/2026/07/12/12_56_04/**`
  - 상세: 각 파일 상단에 "journal 복구" 출처가 명시되어 있고, SUMMARY.md/consistency SUMMARY.md 모두 disk-write gap 보정 사실을 투명하게 기록한다. 내용상 새로운 기능 요구사항을 나타내는 문서가 아니라 이미 수행된 리뷰의 기록이므로 본 리뷰어의 "기능 완전성/엣지케이스/비즈니스 로직" 관점 적용 대상은 아니다(회색지대, INFO).
  - 제안: 없음.

## 요약

핵심 코드 변경(`hooks.controller.ts`/`hooks.controller.spec.ts`)은 embed-config 엔드포인트의 Cache-Control TTL 값(300초/5분)이 실제 응답 헤더와 Swagger 문서 문자열에 중복 하드코딩돼 있던 것을 `EMBED_CONFIG_CACHE_SEC` 단일 상수에서 파생시키는 순수 behavior-preserving DRY 리팩터로, 목적한 기능(단일 진실화)을 완전히 달성했다. 파생값(`public, max-age=300`, 5분)을 직접 계산해 `spec/7-channel-web-chat/4-security.md:112`, `spec/2-navigation/9-user-profile.md:249` 와 line-level 로 대조한 결과 정확히 일치하며, spec fidelity 위반은 없다. 선행 `/ai-review` 세션에서 지적된 WARNING 2건(네이밍·주석 리터럴 잔존)은 실제로 후속 커밋에 반영되어 있음을 워킹트리 상태로 직접 확인했고, 테스트 단언도 SoT 회귀를 실제로 잡을 수 있는 정확값 비교로 강화됐다. 함께 커밋된 다수의 review/ 산출물 파일은 신규 기능이 아니라 완료된 리뷰 세션의 기록 영속화이며 내용 진실성(diff·git log 대조)도 확인됐다. TODO/FIXME, 미완성 에러 경로, 반환값 누락, 엣지 케이스 미처리 등 CRITICAL/WARNING 급 요구사항 결함은 발견되지 않았다.

## 위험도

NONE
