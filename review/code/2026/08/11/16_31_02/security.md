# 보안(Security) Review — `16_31_02`

델타: 커밋 `9416da806`. `git show --stat` 확인 결과 실행 코드 변경 0줄 —
`use-widget.test.ts` 주석 1줄 정정 + `plan/in-progress/webchat-boot-apibase-scheme-validation.md`
회고 절 추가뿐이다. 직전 5라운드(코드+consistency) 전원 NONE/BLOCK:NO.

## 확인 절차

지시대로 라운드 누적 서사(프롬프트)를 따라가지 않고, **최종 상태의 소스**를
직접 열어 4자리 배선을 재확인했다(`codebase/channel-web-chat/src/widget/use-widget.ts`):

1. `safeApiBase(raw, source)` — `http:`/`https:` 스킴만 허용, 그 외(빈 값 제외)는
   `console.warn` 후 `undefined` 반환. `configFromQuery`/`wc:boot` 양쪽 호출부에서
   같은 함수를 공유 — 비대칭 하드닝 갭이 재발하지 않았다.
2. `configFromQuery()` — `safeApiBase(q.get("apiBase"), "configFromQuery")` 로
   쿼리 apiBase 를 검증.
3. `mergeBootConfig(fromQuery, boot)` — spread 로 병합한 뒤
   `merged.apiBase = safeApiBase(boot.apiBase, "wc:boot") ?? fromQuery.apiBase` 로
   **명시적으로 재대입**한다. boot 값이 스킴 거절되거나 명시적 `undefined` 로 와도
   spread 가 검증된 쿼리 값을 지우는 경로가 없다.
4. 호출부: `bridge.onBoot((c) => runApplyConfig(mergeBootConfig(configFromQuery(), c)))` —
   구 인라인 spread(`{ ...configFromQuery(), ...c }`)로 되돌아가지 않았다. direct-load
   폴백은 `fallback.apiBase && fallback.triggerEndpointPath` 게이트를 거쳐
   `runApplyConfig(fallback)` — `configFromQuery()` 를 통하므로 이미 검증된 값만 쓴다.

`use-widget-eager-start.test.ts` 의 wc:boot 호출부 배선 테스트(비-http(s) boot 거절,
정상 http(s) 부팅, 유효 쿼리+악성 boot → 쿼리 승리)도 현재 파일에 그대로 남아 있고
`mergeBootConfig`/`safeApiBase` 실제 구현과 어긋나지 않는다.

이번 델타의 유일한 변경(`use-widget.test.ts:15` 주석)은 "direct-load 전용 방어가
아니다" 로 서술을 정정한 것으로, 검증 로직·분기·호출부에는 손대지 않았다 —
보안 관점에서 영향 없음.

## 발견사항

없음.

## 요약

이번 델타는 테스트 파일 주석 1줄과 plan 문서 회고 절 추가로, 실행 코드 변경이
전혀 없다. 6라운드에 걸쳐 검증돼 온 `safeApiBase`/`configFromQuery`/
`mergeBootConfig`/호출부(및 direct-load 폴백) 4자리 배선을 최종 소스에서 직접
재확인한 결과 여전히 의도대로다 — 두 입력 경로(쿼리·`wc:boot`) 모두 http(s)
스킴만 허용하고, boot 값이 거절되거나 부재해도 쿼리의 검증된 값으로 안전하게
폴백하며, 호출부는 헬퍼를 우회하지 않는다. 새로 도입된 취약점은 없다.

## 위험도

NONE

STATUS: OK
