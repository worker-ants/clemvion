# 변경 범위(Scope) Review

## 발견사항

- **[INFO]** 이번 diff 에는 "eslint-plugin-unicorn pin 복원"이라는 단일 목적 외에 세 갈래 작업이 섞여 있다 — (a) 원 결함 수정(`package.json`/`pnpm-lock.yaml`/`eslint.config.mjs`/`.github/dependabot.yml`), (b) 그 결함을 다루는 `plan/in-progress/eslint-unicorn-peer-restore.md` 신설, (c) 직전 `/ai-review` 라운드(`12_27_15`)의 Warning 3건에 대한 `resolution-applier` 조치 산출물(`PROJECT.md` 갱신, 신규 회귀 테스트 3파일, SoT 통합) 및 그 라운드의 리뷰 세션 아티팩트 14개 파일 커밋.
  - 위치: `plan/in-progress/eslint-unicorn-peer-restore.md:93-100`(체크리스트 항목 "`/ai-review` + Critical/Warning 조치"), `review/code/2026/08/01/12_27_15/RESOLUTION.md:5-11`(조치 표)
  - 상세: (c)는 CLAUDE.md 가 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무(standing opt-in)"로 명시한 워크플로이고, `RESOLUTION.md` 가 각 산출물을 SUMMARY 의 Warning #1~#3 에 1:1 대응시켜 근거를 남겼다. 즉 겉보기엔 범위가 넓어 보이지만(파일 9개+리뷰 아티팩트 14개), 실제로는 "결함 수정 → plan 기록 → 강제 리뷰 → 발견된 Warning 조치"라는 이 저장소의 표준 1-사이클이 전부 한 diff 에 들어온 것뿐이며 목적 밖 추가는 아니다.
  - 제안: 조치 불필요. 향후 리뷰 세션에서도 이 패턴(발견↔조치 표 1:1 대응)이 유지되면 스코프 판단이 쉬워진다.

- **[INFO]** `codebase/backend/src/repo-guards/__tests__/` 에 신규 3파일(`eslint-unicorn-peer.spec.ts` 281줄, `eslint-unicorn-peer-guard.ts` 45줄, `eslint-unicorn-peer-fixture.ts` 8줄)이 추가됐다. Testing reviewer(직전 라운드)의 제안은 "최소로는 fixture 에 `ESLint.lintText` 를 돌려 위반 1건을 assert 하는 unit 테스트만 추가해도 가치가 크다"였는데, 실제 구현은 그보다 훨씬 포괄적이다 — 실측 발화 3케이스 + peer range 정합 2케이스 + 순수 파서 함수별 synthetic 단위테스트(부정 케이스 포함) 총 28개.
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts:1-281`(신규 파일 전체), `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer-guard.ts:1-45`(신규 파일 전체)
  - 상세: 범위 이탈이라기보다 "필요 이상으로 두텁게 만든" 케이스에 가깝다. 다만 (1) 저장소에 이미 존재하는 자매 패턴 `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts`/`.test.ts` 와 구조가 동형(순수 파서 모듈 분리 + 실측 대조 spec)이라 새 컨벤션을 만든 게 아니라 기존 컨벤션을 재사용했고, (2) `RESOLUTION.md:15-25` 에 3종 뮤턴트 검증까지 남겨 vacuous 하지 않음을 스스로 증명했다. over-engineering 으로 보기엔 근거가 탄탄하다.
  - 제안: 조치 불필요. 이후 유사 가드를 또 만들 때는 "최소 unit 1개"와 "자매 패턴 풀세트" 사이의 기준을 plan 컨벤션 문서에 한 줄 남겨두면 이런 판단이 반복되지 않는다(선택).

- **[INFO]** `PROJECT.md:46-51` 구조 변경 — 기존 단일 문단("현재 typescript 1건")을 상위 요약 불릿 + `typescript`/`eslint-plugin-unicorn` 두 개의 중첩 근거 불릿으로 재구성했다. `typescript` 근거 서술은 기존 문단 내용을 그대로 보존해 옮겼을 뿐 삭제·변형이 없다.
  - 위치: `PROJECT.md:49-51`
  - 상세: 구조 변경이지만 두 번째 항목(`eslint-plugin-unicorn`)을 깔끔히 추가하기 위한 최소 리팩터링이며, 리뷰(직전 라운드 Documentation WARNING #1)가 명시적으로 요구한 조치와 정확히 일치한다. 무관한 재정리가 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `pnpm-lock.yaml` snapshots 섹션에 `eslint-plugin-unicorn` 다운그레이드와 직접 무관해 보이는 표기 변경이 섞여 있다 — `eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0(eslint@…))(eslint@…)` 형태의 중첩 peer 키가 `eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@…)` 로 단순화됐다(`eslint-config-next` 소비 블록 2곳, `eslint-module-utils`/`eslint-plugin-import` 자기참조 블록에도 파급).
  - 위치: unified diff 게이트 `15996-16082`(예: `eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@9.39.4(jiti@2.7.0))`), `16046`, `16057`, `16061`, `16067`, `16071`, `16082`
  - 상세: 이 키들은 backend 의 `eslint-plugin-unicorn` 과 무관한 `eslint-config-next`(frontend/channel-web-chat 이 쓰는 패키지) 관련 pnpm resolution key 다. 다만 내용은 순수 표기 단순화(순환 peer 참조가 짧아진 것)이며 `pnpm install` 이 unicorn 다운그레이드로 전체 그래프를 재계산하는 과정에서 부수적으로 함께 재직렬화된 것으로 보인다 — 손으로 편집한 흔적(값 변경·버전 변경)은 없다. 직전 라운드 dependency/side_effect reviewer 가 lockfile 전체를 grep 대조했음에도 이 항목은 짚지 않았다.
  - 제안: 조치 불필요(기계적 재생성 산출물, `pnpm install --frozen-lockfile` 이 통과했다면 정상). 다만 "unicorn 서브트리에만 격리됐다"는 이전 라운드의 단정은 엄밀하게는 이 지점에서 살짝 과장이었다는 점만 기록해 둔다 — 실질적 위험이나 조치 필요는 없다.

## 요약

핵심 결함 수정(`codebase/backend/package.json`·`pnpm-lock.yaml`·`codebase/backend/eslint.config.mjs`·`.github/dependabot.yml`)은 `eslint-plugin-unicorn` peer 계약 복원이라는 단일 목적에 정확히 결속되어 있고, 무관한 리팩토링·기능 확장·포맷팅 잡음·불필요한 임포트/주석 변경은 발견되지 않았다. 나머지 추가분(`plan/in-progress/eslint-unicorn-peer-restore.md`, 신규 회귀 테스트 3파일, `PROJECT.md` 갱신, 리뷰 세션 아티팩트 14개)은 프로젝트가 표준으로 강제하는 "결함 수정 → plan 기록 → 강제 `/ai-review` → Warning 조치" 1-사이클의 산출물이며, `RESOLUTION.md` 가 SUMMARY 의 Warning #1~#3 과 1:1 대응 근거를 남겨 스코프 이탈이 아님을 뒷받침한다. 신규 테스트가 최소 제안보다 두텁긴 하나 기존 자매 패턴(`typescript-toolchain-guard`)을 그대로 재사용한 것이고 mutation 검증까지 남겨 근거가 충분하다. `pnpm-lock.yaml` 에 unicorn 과 직접 무관한 `eslint-config-next` peer 키 표기 단순화가 소량 섞여 있으나 이는 손 편집이 아닌 `pnpm install` 재계산의 부수 효과로, 스코프 위반이 아니라 정보성 관찰 수준이다.

## 위험도

NONE
