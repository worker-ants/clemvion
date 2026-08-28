# 문서화(Documentation) Review

## 발견사항

- **[CRITICAL]** `PROJECT.md` 의 "빌드 툴체인 major 자동 bump 차단" 서술이 이번 PR 로 깨진 자기-결속(2-place 편집) 계약을 갱신하지 않았다 — dependabot ignore 카운트 2건→1건 미반영
  - 위치: `PROJECT.md:57` (및 근거 bullet `PROJECT.md:59`) — 이 두 줄은 diff 대상 밖(리뷰 프롬프트에 포함되지 않음)이라 게이트 숫자가 없다. `Read` 로 저장소의 현재 `PROJECT.md` 를 직접 열어 확인한 실제 줄 번호다.
  - 상세: `PROJECT.md:57` 은 "현재 `typescript`·`eslint-plugin-unicorn` **2건**(`.github/dependabot.yml` 의 `ignore` + `update-types: [...]`)" 이라고 명시하고, 바로 이어서 **"이 개수는 `.github/dependabot.yml` 의 해당 `ignore` 블록 항목 수와 항상 같아야 한다 — 항목을 추가/제거할 때는 이 문장의 카운트도 같은 커밋에서 함께 갱신할 것(2-place 편집)"** 이라는 자체 결속 규약을 걸어 두었다. `PROJECT.md:59` 는 그 아래 `eslint-plugin-unicorn` 항목이 **왜 현재 ignore 되어 있는지**를 설명하는 근거 문단이다.

    그런데 이번 PR 의 `.github/dependabot.yml` 변경(파일 1)은 `eslint-plugin-unicorn` 의 `ignore` 항목 자체(`- dependency-name: "eslint-plugin-unicorn" / update-types: [...]`)를 **완전히 삭제**했다 — 남은 것은 "왜 지웠는지" 를 설명하는 주석뿐이고, ignore 블록에는 이제 `typescript` **1건**만 남는다. 실제로 확인한 현재 `.github/dependabot.yml` 의 `ignore:` 아래에는 `dependency-name: "typescript"` 항목 하나뿐이다.

    `PROJECT.md` 자신이 "항목을 추가/제거할 때는 이 문장의 카운트도 같은 커밋에서 함께 갱신할 것" 이라고 못 박은 바로 그 이벤트(unicorn 항목 제거)가 이번 커밋에서 일어났는데, `PROJECT.md:57`/`:59` 는 갱신되지 않았다. 결과적으로 `PROJECT.md` 는 지금:
    - "현재 2건" 이라는 **틀린 개수**를 담고 있고 (`.github/dependabot.yml` 실측은 1건),
    - `eslint-plugin-unicorn` 이 **여전히 major auto-bump 로부터 보호되고 있다**는 **틀린 인상**을 준다. 실제로는 dependabot 이 이제 `eslint-plugin-unicorn` 의 향후 major 도 자동 PR 화할 수 있다(`.github/dependabot.yml` 새 주석 자체가 "되살릴 조건: unicorn 의 peer eslint floor 가 다시 넘을 때" 라며 재발 가능성을 인지하고 있음에도, `PROJECT.md` 독자는 이 사실을 모른 채 "여전히 ignore 되어 있다" 고 믿게 된다).

    이 결함이 특히 아이러니한 이유: `PROJECT.md:59` 의 `eslint-plugin-unicorn` 근거 문단 자체가 **정확히 이번 PR 이 재발을 막으려는 그 사고(`#1049`: "값만 바뀌고 주석은 갱신되지 않아 코드-문서가 어긋난 채 머지됐다")** 를 설명하는 문단이다. 그런데 이번 PR 이 `PROJECT.md` 쪽에서 같은 유형의 코드-문서 drift(값은 바뀌었는데 최상위 SoT 문서 카운트는 그대로)를 새로 만들었다.

    참고로 이번 PR 은 유사한 "N개 워크스페이스" 미러(본문 §범위·체크박스·`dependabot.yml`·`eslint.config.mjs` 4곳)는 `plan/in-progress/deps-peer-gating-and-eslint10.md` 체크리스트에서 명시적으로 추적하고 동시 갱신했다(10→11개 정정, 파일 29 diff L196-204) — 그러나 `PROJECT.md` 의 이 별도 카운트 미러는 그 추적 목록에 없었고, 결과적으로 놓쳤다.
  - 제안: `PROJECT.md:57` 을 "현재 `typescript` **1건**(`.github/dependabot.yml` 의 `ignore` + `update-types: [...]`)" 로 정정하고, `PROJECT.md:59` 의 `eslint-plugin-unicorn` bullet 은 (a) 삭제하거나 (b) "과거에 ignore 되어 있었으나 2026-08-28 eslint 10 상향으로 전제가 사라져 제거됨 — 재발 방지는 `eslint-unicorn-peer.spec.ts` 상시 가드 + CI `--strict-peer-dependencies` 로 이관" 형태의 역사적 각주로 격하한다. 어느 쪽이든 "현재 활성 ignore" 로 읽히는 현재 서술은 제거해야 한다.

## 그 외 관점별 평가 (문제 없음 — 근거 포함)

- **독스트링/JSDoc**: `parseGteFloor`(파일 16)·`readInstalledPackageJson`(파일 17) 모두 "왜 필요했는지(2026-08-28 실측)" 를 근거·구체적 실패 사례와 함께 갱신했다. 특히 `readInstalledPackageJson` 은 `eslint-plugin-unicorn@73` 의 `exports` 맵 제약으로 `require(.../package.json)` 이 막힌 실측 사실을 정확히 기록해 향후 유지보수자가 "왜 `req()` 대신 파일 경로 읽기인지" 되짚을 필요가 없게 했다. 예시로 다룰 만큼 우수함.
- **README 업데이트**: 이번 변경은 devDependency 툴체인(eslint) 버전 상향이며, 루트 `README.md:117` 의 "Node.js 24+" 요구사항은 eslint 10 의 엔진 플로어(`^20.19.0 || ^22.13.0 || >=24`, lockfile 확인)를 이미 만족한다. README 갱신 불요.
- **API 문서**: API 엔드포인트·계약 변경 없음(순수 lint 툴체인 + 내부 코드의 lint-driven 소소 리팩터). 해당 없음.
- **주석 정확성**: `.github/dependabot.yml`(파일 1)·`codebase/backend/eslint.config.mjs`(파일 2)·`codebase/frontend/eslint.config.mjs`(파일 19)·`codebase/channel-web-chat/eslint.config.mjs`(파일 18) 는 실측 표·날짜·근거를 정확히 갱신했고 서로 SoT/참조 관계도 명시했다(중복 기재 회피). `let x: T | null = null` → `let x: T | null;` 패턴 변경(파일 4·5·6·8·13·14·28)의 인접 주석들은 전부 "왜 이 값을 쓰는가" 를 설명하는 비즈니스 로직 주석이지 초기값 자체를 언급하지 않아, 초기값 제거로 인해 어긋난 주석은 없음을 각 파일 컨텍스트로 확인함(`execution-engine.service.ts` catch 블록이 즉시 return, `kb-tool-provider.ts`/`information-extractor.handler.ts` catch 블록이 즉시 return 또는 fallback 대입 — TS definite-assignment 를 깨지 않음).
- **인라인 주석**: `text-chunker.ts`(파일 9)·`knowledge-base.service.ts`(파일 10) 는 삭제된 dead-code 대입 자리에 "왜 지웠는지" 설명하는 주석을 새로 남겨 `no-useless-assignment` 룰 수정이 침묵 삭제로 끝나지 않게 했다. `secret-resolver.service.ts`(파일 11) 의 `eslint-disable-next-line preserve-caught-error` 는 왜 이 한 곳만 규칙을 끄는지(`cause` 를 달면 의도된 에러 추상화가 무의미해짐, `#814` 참조) 근거를 남겨 억제-남용 우려를 해소함. `ai-turn-executor.ts`(파일 12) 의 `let → const` 전환도 "왜 이제 갱신이 불필요한가" 를 두 지점 모두에 설명함.
- **변경 이력(CHANGELOG)**: `CHANGELOG.md` 는 사용자/운영 영향이 있는 변경만 기록하는 컨벤션으로 보이며(최근 항목들이 전부 "운영 영향" 문단을 갖춤), 이번 PR 은 devDependency·lint 툴체인 변경 + 내부 코드의 lint 준수 리팩터로 사용자에게 관측 가능한 동작 변화가 없다. `cause: err` 추가(파일 7·15)도 `.message` 표면은 그대로이고 `.cause` 는 로그/디버깅 전용이라 API 응답 변화 없음. CHANGELOG 갱신 불요.
- **설정 문서**: 신규 환경변수 없음. eslint 버전 정책·frontend/channel-web-chat 이 eslint 9 에 남는 이유는 각 `eslint.config.mjs` 헤더에 SoT 로 기록되어 있고, `plan/in-progress/deps-peer-gating-and-eslint10.md`(파일 29) 가 실행 결과·실측 표·해제 조건을 상세히 기록함(예시로 다룰 만큼 우수함).
- **예제 코드**: `eslint-unicorn-peer.spec.ts`(파일 17) 에 `>=10.4`/`>=9.18`/`>=9`/`>=10` 등 자릿수 형태별 회귀 테스트 케이스와, eslint 10 상향 전/후 상태를 대조하는 테스트가 추가되어 "이 파서가 왜 이렇게 동작해야 하는가" 를 실행 가능한 예제로 고정함.

## 요약

이번 PR 의 문서화 수준은 전반적으로 이 저장소의 최상위 관행("주석은 SoT, 근거·실측·날짜와 함께")을 충실히 따르는 모범적인 사례다 — `dependabot.yml`, 양쪽 `eslint.config.mjs`, repo-guard 테스트/JSDoc, plan 문서 모두 값 변경과 근거 주석을 같은 커밋에서 동기화했다. 그러나 정확히 그 동기화 규율을 스스로 명문화해 둔 `PROJECT.md:57`("이 문장의 카운트도 같은 커밋에서 함께 갱신할 것(2-place 편집)")가 이번 PR 에서 지켜지지 않았다 — `.github/dependabot.yml` 의 `eslint-plugin-unicorn` ignore 항목이 삭제되어 ignore 블록이 2건→1건이 됐는데 `PROJECT.md` 의 "2건" 서술과 그 근거 문단은 그대로 남아 있다. 이는 이번 PR 이 재발 방지 근거로 여러 번 인용하는 `#1049` 사고("값만 바뀌고 주석은 갱신되지 않아 코드-문서가 어긋난 채 머지됐다")와 같은 유형의 결함을 최상위 SoT 문서에 새로 만든 것이라 심각도를 낮게 볼 수 없다.

## 위험도

HIGH
