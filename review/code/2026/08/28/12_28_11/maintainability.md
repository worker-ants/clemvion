# 유지보수성(Maintainability) 리뷰 — eslint 9→10 상향

## 검토 범위

`codebase/**`·`.github/dependabot.yml`·`PROJECT.md`·`plan/in-progress/deps-peer-gating-and-eslint10.md`
(파일 1~33)을 실질 검토 대상으로 삼았다. 파일 34~64(`review/code/2026/08/28/11_45_02/**`,
`review/consistency/2026/08/28/{11_15_50,12_20_11}/**`)는 이전 리뷰 라운드가 이미 생성해 커밋한
산출물(리포트·상태 JSON)이라 "유지보수할 코드"가 아니므로 이 관점에서는 대상에서 제외했다 — 단,
그 안의 `maintainability.md`(11_45_02)가 지적한 두 건이 이번 diff 에서 실제로 해소됐는지는
아래 "검증한 항목"에서 직접 대조했다.

## 발견사항

- **[INFO]** 같은 사고(`#1049`)의 "왜" 서사가 세 파일에 걸쳐 각각 완결된 형태로 반복 기술된다 — 값(SoT)은 한 곳이지만 서사는 3곳
  - 위치: `.github/dependabot.yml:75-88`, `PROJECT.md:59`, `codebase/backend/eslint.config.mjs:19-38`
  - 상세: 세 파일 모두 "dependabot #1049 가 `^56`→`^72` 로 올려 unmet peer 를 만들었다 → 주석이 안 갱신돼 코드-문서 drift → eslint 10 상향으로 전제 소멸 → 재발 방지는 `eslint-unicorn-peer.spec.ts` + `--strict-peer-dependencies`" 라는 동일한 역사 서사를 완결된 문단으로 각각 다시 쓴다. `eslint.config.mjs` 헤더가 "registry 실측 표는 이 저장소의 SoT" 라 명시하고 `dependabot.yml`도 "값을 갱신할 때는 여기 한 곳만 고치면 된다"고 참조만 하겠다고 선언하지만, 그 SoT 선언이 지키는 건 **숫자 표(56.x=`>=8.56.0` 등)** 뿐이고, 사건의 서사 자체는 세 곳에 독립적으로 존재한다. 이 저장소가 `#1049`에서 배운 교훈이 정확히 "주석-값 drift" 였다는 점을 감안하면, 다음에 이 사건 서술을 갱신할 일(예: 오탈자 정정, 이슈 번호 정정)이 생기면 3곳을 동시에 손대야 하고 하나를 놓쳐도 아무 가드도 잡아내지 못한다(서사 텍스트는 자동 검증 대상이 아니다).
  - 대조: 같은 PR 안에서 `codebase/frontend/eslint.config.mjs`(신규 헤더, 게이트 1~21줄)와 `codebase/channel-web-chat/eslint.config.mjs`(신규 헤더, 게이트 1~4줄)는 정확히 이 문제를 피해간다 — channel-web-chat 쪽은 "실측 표와 해제 조건의 SoT 는 `codebase/frontend/eslint.config.mjs` 헤더 — 여기서 중복 기재하지 않는다" 라고만 쓰고 서사를 반복하지 않는다. 같은 PR 안에 "참조만 하기"를 실제로 지킨 사례(frontend/channel-web-chat 쌍)와 "참조한다고 말하지만 서사를 반복"한 사례(backend/dependabot/PROJECT.md 삼각)가 공존해 컨벤션 적용이 일관되지 않는다.
  - 제안: 급한 조치는 아니다(수치 SoT 는 지켜지고 있고 회귀 가드도 있다). 다음에 이 세 파일 중 하나를 만질 때, `dependabot.yml`·`PROJECT.md` 쪽 서술을 frontend/channel-web-chat 패턴처럼 "SoT 는 `eslint.config.mjs` — 여기서 반복 기재하지 않는다" 한 문장 + 링크로 줄이는 것을 고려할 것.

- **[INFO]** `eslint.config.mjs` 의 `unicorn` 플러그인 등록 블록 — 코드 1줄에 주석 23줄
  - 위치: `codebase/backend/eslint.config.mjs:16-39` (`plugins: { unicorn: eslintPluginUnicorn },` 한 줄에 앞서 23줄의 주석)
  - 상세: 등록 자체는 한 줄이지만 그 앞에 붙는 주석이 (1) 왜 preset 대신 단일 룰만 쓰는지, (2) 이번에 `^56`→`^73` 으로 올린 사유, (3) SoT 선언, (4) 버전별 peer floor 실측 표, (5) 파서 한계로 fail-closed 걸렸던 사건, (6) `#1049` 역사 — 6개의 서로 다른 관심사를 한 블록에 담고 있어 이 파일을 처음 여는 사람은 실제 설정(`plugins: {...}`)을 찾기 전에 긴 서사를 읽어야 한다.
  - 상세(완화 사유): 이 저장소는 "왜"를 코드 옆에 남기는 관행을 명시적으로 지향하고(메모리·PROJECT.md 전반), 이 블록도 그 관행을 따른 것이라 스타일 이탈은 아니다. 다만 관심사 6개가 섞여 있어 다음에 "SoT 표만 갱신"하려는 사람이 다른 5개 문단까지 건드릴 유혹(또는 실수로 일부만 갱신)에 노출된다.
  - 제안: 강제하지 않음. 필요하면 "registry 실측 표"만 별도 블록으로 분리하고 나머지 역사 서술은 링크(`plan/in-progress/...` 등)로 축약하는 리팩터를 다음에 이 파일을 열 때 고려.

## 검증한 항목 (문제 없음 — 이전 라운드 지적 사항의 해소 여부 확인)

- 이전 라운드(`review/code/2026/08/28/11_45_02/maintainability.md`)가 지적한 두 건은 이번 diff 에서 실제로 해소됐다.
  1. "`dependabot.yml` 의 22줄짜리 고아 주석" → 현재 `.github/dependabot.yml:75-88` 는 14줄로 축약됐고, 삭제된 `ignore` 항목을 직접 참조하는 "(묘비)" 문구로 시작해 어떤 노드에 대응하는 설명인지 명확하다.
  2. "`secret-resolver.service.ts` 의 `eslint-disable-next-line` 에 인라인 `-- 사유` 가 없어 저장소 컨벤션(`code.handler.ts` 류)과 불일치" → `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:94` 현재 `// eslint-disable-next-line preserve-caught-error -- cause 보존 시 crypto 에러 상세가 Activity API 로 노출됨 (SS-SE-05, #814 근거)` 로 인라인 사유가 붙어 컨벤션과 일치한다.
- `let x: T = <default>;` → `let x: T;` 형태의 dead-initializer 제거(`no-useless-assignment`, eslint 10 recommended)가 8개 파일(`ssrf-safe-url.util.ts:156`, `form-mode.ts:289`, `execution-engine.service.ts:4918`, `public-webhook-throttle.guard.ts:67`, `kb-tool-provider.ts:239`, `information-extractor.handler.ts:332`, `web-chat-sdk/src/index.ts:63`)에 걸쳐 동일 패턴으로 적용됨. 각 지점에서 catch 블록이 조기 `return`/`throw` 하거나 이후 재대입되는 구조라 실제 미할당 참조 경로가 없음을 직접 코드를 열어 확인했다. 일관된 스타일, 동작 변화 없음.
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `finalSystemPrompt` 재할당 두 곳(게이트 1620줄, 2038줄 인접 주석)을 삭제하고 "왜 갱신하지 않는지"를 설명하는 주석으로 대체한 것을 직접 `grep`으로 검증: `executeMultiTurn`(1939행 시작)·단일턴 경로 모두에서 해당 지역변수가 주석 이후 그 함수 스코프 안에서 다시 읽히지 않는다(2432행의 동일 이름 파라미터는 `applyMultiTurnTurnMemory`라는 별개 메서드의 지역 변수라 무관함을 별도 확인). 안전한 정리이며 의도를 남긴 것도 좋은 관행.
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:601` — `graphRequeued -= slice.length;` 제거 후 남긴 주석("아래 `throw err` 로 반환 자체가 일어나지 않는다")을 실제 함수 본문 대조로 확인 — catch 블록이 항상 `throw err;`로 끝나 `return { embeddingRequeued, graphRequeued }`에 도달하지 않는다. 데드코드 제거가 정확하고 주석도 정확하다.
- `eslint-unicorn-peer-guard.ts`(`parseGteFloor`) — 정규식을 `>=X.Y.Z` 전용에서 `>=X`/`>=X.Y`/`>=X.Y.Z` 까지 확장. JSDoc이 "왜 3-component 만으로 부족했는지"를 실측과 함께 설명하고, 대응 테스트(`eslint-unicorn-peer.spec.ts`)에 회귀 케이스와 무효 케이스를 모두 추가 — 형태(자릿수) 축을 커버리지에 반영한 좋은 예. `req()`(createRequire) 헬퍼는 이 파일 안에서 `backend/package.json`·`eslint/package.json` 조회에 여전히 쓰이고 있어(197줄·232줄), `readInstalledPackageJson` 신설 후에도 미사용 변수로 남지 않았다.
- `readInstalledPackageJson` 헬퍼(`eslint-unicorn-peer.spec.ts`) — 두 개의 서로 다른 `it` 블록에서 같은 헬퍼를 재사용(중복 로직 아님)하며, `exports` 맵 제약으로 `require` 서브패스가 막힌 이유가 JSDoc 에 명확히 기술됨.
- 9개 `package.json`(backend 제외, packages/* 전부)에 걸친 거의 동일한 eslint 버전 diff는 모노레포 워크스페이스 특성상 불가피한 반복이며 DRY 위반으로 볼 성격이 아니다.

## 요약

이번 변경은 ESLint 9→10 상향(backend + packages 9개)과 그로 인해 새로 활성화된 `no-useless-assignment`/`preserve-caught-error` 규칙 위반 15건의 기계적 수정, 관련 문서(`dependabot.yml`·`eslint.config.mjs` 헤더·`PROJECT.md`·plan 문서) 근거 갱신, 그리고 파서 가드(`parseGteFloor`) 확장으로 구성된다. 이전 리뷰 라운드가 지적한 두 건(고아 주석·disable 인라인 사유 누락)은 이번 diff 에서 이미 해소되어 있음을 직접 대조 확인했다. 코드 변경 각각은 범위가 좁고 "왜 안전한지"를 코드 흐름 추적으로 검증했으며 문제되는 지점은 찾지 못했다 — dead-initializer 제거·dead-store 제거·주석 정합성 모두 실질적인 개선이다. 새로 발견한 것은 INFO 2건뿐이다: (1) `#1049` 사건 서사가 값의 SoT 선언과 달리 세 문서(`dependabot.yml`/`PROJECT.md`/`eslint.config.mjs`)에 완결된 형태로 반복돼 있어 같은 PR 안의 frontend/channel-web-chat 쌍이 보여주는 "참조만 하기" 패턴과 대비되는 일관성 이탈, (2) `eslint.config.mjs`의 unicorn 등록 블록이 코드 1줄 대비 주석 23줄로 여러 관심사를 한 블록에 담고 있음(저장소 관행상 스타일 이탈은 아님). 둘 다 병합을 막을 사유는 아니다.

## 위험도

LOW
