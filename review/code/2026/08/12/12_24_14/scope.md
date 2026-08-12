# 변경 범위(Scope) 리뷰 — 세션 `12_24_14` (누적 diff, backend lint warning 처분 + 게이트 도입)

## 컨텍스트 — 이번 세션은 3번째 스코프 리뷰 라운드다

이 diff(38개 파일)는 `origin/main...HEAD` 누적 diff로, 이미 두 차례(`11_06_12`, `12_05_39`)
scope 리뷰를 거쳤고 두 번 다 CRITICAL/WARNING 없이 NONE/LOW 로 수렴했다(각 라운드의
`scope.md` 자체가 이번 diff 에 파일 22, 35 로 포함되어 있어 직접 대조 가능). 따라서 이번
라운드에서는 (a) 이미 검토된 코드가 재노출된 부분은 중복 재검증하지 않고, (b) **이전
라운드 리뷰 시점에 존재하지 않았던 진짜 신규 변경**만 집중 검증했다.

### 신규 변경 식별 방법

`12_05_39/meta.json`(파일 33, 이번 diff에 포함)의 `files[]` 목록과 이번 프롬프트의 파일
목록(1~38)을 대조했다. `12_05_39` 시점 파일 목록에 **없었던** 것:

- `codebase/backend/README.md` (파일 1)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (파일 7)
- `review/code/2026/08/12/12_05_39/*` 13개 파일 자체(파일 26~38) — 그 라운드의 산출물이
  처음으로 커밋되어 diff에 나타남

나머지 코드 파일(2~6, 8~14)과 `plan/*.md`(15), `11_06_12/*`(16~25)는 `12_05_39` 라운드가
이미 라인 단위로 diff를 열람·검증한 것과 동일한 hunk다(예: 파일 33 `meta.json` 목록에
동일 경로가 그대로 등장).

## 발견사항

- **[INFO]** README.md 수정과 `idempotency.interceptor.spec.ts` 신규 테스트 5건은 각각
  `12_05_39/RESOLUTION.md`(파일 26)의 WARNING #2·#1 조치 내역과 **정확히 일치**한다
  - 위치: `codebase/backend/README.md:19`(diff 게이트 기준), `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:11,17,39-51,139-286`
  - 상세: `RESOLUTION.md`가 예고한 문구("ESLint — 트리를 고치지 않음(`--fix` 없음). **warning
    1건도 실패**(`--max-warnings 0`)")가 README diff와 토씨까지 같고, 예고한 5개 테스트
    (캐시 히트 재생, 409 충돌, 4xx 캐시 제외, `status`/`statusCode` 없는 응답 200 적재,
    캐시 히트 재생 시 `status` 없어도 안전)가 diff에 그대로 있다. `responseOverride` 옵션
    추가와 JSDoc 확장도 그 옵션의 사용처를 설명하는 것뿐이라 drive-by가 아니다. 스코프
    이탈 없음 — WARNING을 낸 리뷰 라운드 자신이 요구한 정확한 조치.
  - 판정: 문제 없음(발견 아님, 대조 확인 목적).

- **[INFO]** 리뷰 산출물 번들링이 3라운드째 계속 누적된다 — `11_06_12`(10파일) →
  `12_05_39`(13파일, 이번에 처음 diff 노출) → 이번 세션(`12_24_14`) 자신의 산출물은 아직
  diff 밖(리뷰 진행 중이므로 당연)
  - 위치: `review/code/2026/08/12/11_06_12/*`(16~25), `review/code/2026/08/12/12_05_39/*`(26~38)
  - 상세: 38개 변경 파일 중 실질 코드/plan 파일은 15개(1~15)뿐이고 나머지 23개(16~38)는
    전부 리뷰 세션 산출물이다. 두 이전 scope 라운드가 이미 이 패턴을 INFO로 지적했고
    ("코드 diff의 4배 이상 크기") 규약 위반은 아니라고 판정했다(CLAUDE.md의 "구현 완료
    후 자동 review/fix 는 상시 승인된 강제 의무" — 산출물 커밋이 표준 워크플로). 이번
    라운드가 끝나면 `12_24_14/*` 산출물이 다시 다음 diff에 얹혀 4라운드째 같은 패턴이
    반복될 구조다. 코드 결함은 아니지만, PR을 최종 검토/스쿼시할 때 "코드 diff"와
    "review/** 산출물 diff"를 분리해서 보는 습관이 계속 필요하다는 관찰을 다시 남긴다.
  - 제안: 조치 불요. 머지 전 PR 설명에 "review/** 는 산출물이며 기능 diff 아님"을
    명시하는 정도로 충분.

- **[INFO]** 이번 diff에 새로 포함된 `idempotency.interceptor.spec.ts` 5건 추가는 "타입
  주석만" 이라는 브랜치 최초 선언 범위를 넘는 행위 검증 코드다 — 그러나 원인이 된
  WARNING이 이미 이 확장을 명시적으로 요구했고 disclosure도 됨
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:139-286`
  - 상세: `migrate-node-output-refs.spec.ts`의 Pass 2 테스트(11_06_12 라운드)와 같은 패턴 —
    "타입만 붙인다"던 최초 목표를 테스트 커버리지 보강이 다시 한번 넘어선다. 다만 이번에도
    은폐가 아니라 `RESOLUTION.md`(파일 26)가 뮤테이션 판별력(가드 2곳을 각각 무력화 →
    "1 failed / 8 passed")까지 실측해 근거를 남겼다. 스코프 이탈이 반복되는 패턴 자체는
    주목할 만하지만(이 브랜치에서 벌써 2번째), 매번 정직하게 disclosure되고 있어 CRITICAL/
    WARNING 사유는 아니다.
  - 제안: 조치 불요. 다음에 유사 상황이 또 나오면(3번째) "커밋 메시지의 선언 범위를
    테스트 보강까지 포함하도록 애초에 넓혀 적는 것"을 고려.

그 외 CRITICAL/WARNING 급 스코프 이탈은 **발견되지 않았다.**

## 점검 관점별 확인 내역 (신규 변경분 한정)

1. **의도 이상의 변경** — 없음. README/spec 신규분 모두 직전 라운드 WARNING의 직접 조치.
2. **불필요한 리팩토링** — 없음.
3. **기능 확장** — 없음. `responseOverride` 는 테스트 mock 파라미터일 뿐 프로덕션 코드
   확장이 아니다.
4. **무관한 수정** — 없음. 신규 파일 2개(README, spec) 모두 이 브랜치의 핵심 파일
   (`idempotency.interceptor.ts`)과 직결.
5. **포맷팅 변경** — README 표 한 줄 교체 외 순수 포맷팅 변경 없음.
6. **주석 변경** — `makeContext` JSDoc 확장은 신규 `responseOverride` 파라미터 설명이라
   drive-by 아님.
7. **임포트 변경** — spec 파일에 `crypto.createHash`, `@nestjs/common.ConflictException`
   2건 추가, 둘 다 신규 테스트가 실제로 사용(`bodyHashOf`, `.rejects.toThrow(ConflictException)`).
   미사용 임포트 없음.
8. **설정 변경** — 이번 신규분에는 설정 파일 변경 없음(`package.json` `--max-warnings 0`은
   이전 라운드부터 이미 존재하던 변경이 누적 diff에 재노출된 것).

## 요약

이번 세션(`12_24_14`)이 처음 마주하는 실질 신규 변경은 `README.md` 문구 수정 1건과
`idempotency.interceptor.spec.ts` 신규 테스트 5건뿐이며, 둘 다 직전 라운드(`12_05_39`)가
낸 WARNING #1·#2 에 대한 `RESOLUTION.md` 의 예고 내용과 정확히 일치하는 직접 조치라
스코프 이탈이 아니다. 나머지 코드 파일(15개 중 13개)과 `11_06_12` 산출물은 이전 두
scope 라운드가 이미 라인 단위로 검증했고 이번에 재노출된 동일 hunk다. 유일하게 반복
관찰되는 패턴은 (1) 리뷰 산출물이 3라운드째 diff에 계속 누적되는 것(코드 15파일 대
리뷰산출물 23파일)과 (2) "타입 주석만"이라는 최초 선언 범위를 테스트 보강이 이번에도
넘어섰다는 것인데, 둘 다 프로젝트 표준 워크플로에 부합하고 매번 투명하게 disclosure
되고 있어 CRITICAL/WARNING 대상은 아니다.

## 위험도

LOW

STATUS: OK
