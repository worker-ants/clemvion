# 문서화(Documentation) 코드 리뷰

대상: `eia-error-code-unify` — Manual 세 경로(`execute`/`save`/`re-run`) 중 `re-run` 만 남아 있던
`error.code` drift(`INVALID_INPUT`)를 `INVALID_TRIGGER_PARAMETERS` 로 통일한 rename PR. 이번
diff 는 직전 리뷰 라운드(`17_06_14`, WARNING 6건, RISK MEDIUM)의 fix 커밋
(`480a6eea3` — CHANGELOG 신설 + 테스트 코드값 단언 보강)과 그 RESOLUTION/SUMMARY 산출물 자체를
커밋에 포함한 상태다.

## 검증 방법

프롬프트에 실린 unified diff 35개 파일을 확인하고, 실제 애플리케이션 코드·spec·plan·CHANGELOG
는 저장소 원본을 `Read`/`Bash`(grep, sed)로 직접 열어 대조했다(`review/code/2026/08/22/17_06_14/*`,
`review/consistency/2026/08/22/16_34_50/*` 는 과거 리뷰/consistency 세션의 산출물을 그대로 커밋한
것이라 문서화 관점에서 신규 애플리케이션 코드 리스크는 없음 — 내용 대조만 함).

- `grep -rn 'INVALID_INPUT' codebase spec` — 잔존 4건 전부 "여기가 예전엔 `INVALID_INPUT` 이었다"
  는 이력 서술(주석 1건 + spec 각주 3건)이고 발행 지점은 0건. plan 이 주장한 실측과 일치.
- `grep -n 'TBD_PR' spec` — `error-codes.md:145` 1건, 아직 미치환.
- §4 H2 헤더(`## 4. 내부 전용 분류 코드 (정규화 후 발행)`) 텍스트가 §4.1/§4.2 분리 후에도
  그대로라 `12-webhook.md:313`·`3-error-handling.md:109` 의 인입 앵커(`#4-내부-전용-분류-코드-정규화-후-발행`)
  가 깨지지 않음을 확인.
- `codebase/backend/src/modules/executions/executions.service.ts:510` 의 `code:` 값과 그 위
  주석(506-509행)이 서로 일치함을 확인 — **주의**: 검증 중 이 값이 순간적으로 `INVALID_INPUT`
  으로 관측된 시점이 있었으나 재확인 결과 `git status` 는 clean, 값은 `INVALID_TRIGGER_PARAMETERS`
  로 안정적이었다. 동시에 도는 다른 리뷰 에이전트(RESOLUTION.md 가 기술한 mutation 실측 방법론과
  동일 패턴)가 공유 워크트리를 일시적으로 뮤테이션한 것으로 판단해 발견사항에서 제외했다
  (실제 커밋/HEAD 상태의 결함이 아님).

## 발견사항

- **[WARNING]** `spec/conventions/error-codes.md` §5 Rename 이력 표 신규 행의 "PR" 컬럼이 여전히
  플레이스홀더 `#TBD_PR` 이다
  - 위치: `spec/conventions/error-codes.md:145`
  - 상세: 직전 리뷰 라운드(`17_06_14` documentation WARNING #2)가 이미 지적했고, 그 RESOLUTION
    (`review/code/2026/08/22/17_06_14/RESOLUTION.md` W4)도 "PR 번호는 생성 전에는 존재하지
    않으므로 placeholder 로 커밋한 뒤 `gh pr create` 직후 같은 브랜치에 치환 커밋을 올린다" 고
    명시적으로 계획해 둔 상태다. 즉 **알려진, 의도적으로 지연된** 갭이지 새 발견은 아니다.
    다만 이 리뷰 시점(`git log` 상 아직 PR 미생성, `HEAD=dbd4aa18c`)까지도 값이 채워지지 않았으므로
    최종 push/머지 전 완료 여부를 다시 확인해야 한다.
  - 제안: RESOLUTION W4 계획대로 `gh pr create` 직후 `#TBD_PR` → 실제 PR 번호 치환 커밋을 올리고,
    push 전 `grep -rn TBD_PR spec` = 0 을 확인할 것.

## 검증 완료 항목 (문제 없음)

- **CHANGELOG**: 직전 라운드 WARNING(#1 — breaking 변경인데 항목 없음)이 이번 diff 로 해소됨.
  `CHANGELOG.md:3-27` 신설 `## Unreleased` 절이 (1) 바뀌는 값과 영향 엔드포인트, (2)
  `error.details[]` 항목 코드는 불변이라는 점, (3) `spec/conventions/error-codes.md §2` 규약
  예외 근거와 §5 선례 대비 리스크 등급 차이, (4) 유저 가이드 선존 오류 동반 정정까지 모두
  정확히 반영했다. 저장소 관행(`## Unreleased — <제목>` 섹션을 PR 마다 추가)과도 형식이 일치.
- **주석 정확성**: `executions.service.ts:506-509` 신규 주석("자매 호출부와 같은 코드 · 2026-08-22
  이전엔 이 자리만 `INVALID_INPUT` · rename 근거는 `error-codes.md §5`")이 실제 코드값·spec 상태와
  정확히 일치(위 mutation 관측 노이즈 제외 시).
- **API 문서(Swagger)**: `executions.controller.ts:274` `@ApiBadRequestResponse` description 이
  코드 값 변경과 함께 갱신됨.
- **테스트-문서 정합**: `executions-rerun.service.spec.ts:330-361` 제목·본문이 이제 코드값을
  직접 단언(`toMatchObject({ code: 'INVALID_TRIGGER_PARAMETERS' })`)하고, 신규 인라인 주석이
  왜 이 단언이 필요한지(`17_06_14` testing W5 캐너리 실측 결과)를 정확히 설명한다 — 직전 라운드
  WARNING(#5 제목-본문 불일치)이 이번 diff 로 해소됨.
- **유저 가이드(mdx, KO/EN)**: `triggers.mdx:33`·`triggers.en.mdx:22` 갱신, 부수로 선존 오류
  (주 실행 경로도 원래 `INVALID_TRIGGER_PARAMETERS` 였는데 `INVALID_INPUT` 으로 잘못 적혀 있던
  것)를 정정.
- **spec 6파일 동반 개정**: `1-manual-trigger.md §6`(코드 표 + wrapper 함수명·CI 가드 신규 콜아웃),
  `13-replay-rerun.md §8.1`(코드 값 + `RERUN_` prefix 미사용 각주 갱신), `3-error-handling.md`
  (카탈로그 행 교체 + "무엇이 뒤집혔는지" 콜아웃, 반대 방향 옛 Rationale 을 지우지 않고 정정),
  `12-webhook.md:313`(세 경로 공용 서술로 교정), `14-external-interaction-api.md §R17`(구현 위치
  콜아웃 신규), `error-codes.md`(§4→§4.1/§4.2 분리 + §5 신규 행) — 전부 상호 참조·앵커·grep 결과가
  실측과 일치. §4 분리는 직전 consistency 리뷰(`16_34_50` W2)의 "단순 append 금지" 지적을 실제로
  반영한 결과이며, 표 scope 선언과 신규 trigger-parameter 계열 간 충돌이 해소됨을 확인.
- **인라인 주석**: `error-codes.md §5` 신규 행 비고에 "본 표 리스크 등급 최고" + 판정 근거("부재
  확인"이 아니라 "관측 범위 미발견")를 명시해, 향후 이 표를 "공개 API 든 rename 안전"으로
  일반화하지 말라는 경고까지 남긴 점이 이례적으로 정확하다.
- **plan/tracker 문서**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 관련
  이월 항목 4건이 이번 diff 로 `[x]` 전환되며 각각 닫힌 근거(실측 grep 결과, 반영 방식)를 남김.
  `plan/in-progress/eia-error-code-unify.md` 는 결정·규약 예외 근거·실측 기준점·spec 3곳 동반
  개정 필요성을 상세히 기록.
- **README**: 이 변경과 관련해 갱신이 필요한 README 는 발견되지 않음.
- **예제 코드**: 값 rename 범위라 신규 사용법 예제는 불필요.

## 요약

핵심 diff(`error.code` 리터럴 1곳 rename)는 좁지만, 그 주변 문서 표면(CHANGELOG, Swagger, 테스트
단언, spec 6파일, 유저 가이드 KO/EN, plan tracker)의 정합성은 이례적으로 높은 정확도로 관리됐다.
직전 리뷰 라운드가 낸 WARNING 6건 중 문서화 관련 2건(CHANGELOG 부재, 테스트 제목-본문 불일치)은
이번 diff 로 완전히 해소됐다. 유일하게 남은 항목은 `error-codes.md §5` 의 `#TBD_PR` placeholder —
다만 이는 "PR 번호는 생성 전에 존재하지 않는다"는 구조적 제약 때문에 RESOLUTION 이 이미
"PR 생성 직후 치환 커밋" 으로 명시 계획해 둔 지연이라 새 결함이 아니다. push/머지 직전에
계획대로 치환됐는지만 재확인하면 된다.

## 위험도

LOW
