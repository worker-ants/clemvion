# 문서화(Documentation) Review

## 발견사항

- **[INFO]** `dependabot.yml` `ignore:` 블록에 살아있는 YAML 노드가 없는 "묘비(tombstone)" 주석 두 단락이 남아 있다
  - 위치: `.github/dependabot.yml:75-88`
  - 상세: `eslint-plugin-unicorn` ignore 항목(`- dependency-name: "eslint-plugin-unicorn"`)이 이번 PR에서 완전히 삭제됐고, 그 삭제 사유(75-81줄)와 "eslint 자체는 여기서 막지 않는다"는 별도 설명(83-88줄) 두 블록만 `ignore:` 리스트 끝에 남았다. `# (묘비)` 라고 스스로 라벨을 붙였고 되살릴 조건·SoT 참조(`PROJECT.md`, `eslint-unicorn-peer.spec.ts`, `codebase/frontend/eslint.config.mjs`)까지 명시해 이미 위쪽 `typescript` 항목과 같은 수준의 근거-우선 관행을 따르고 있다. YAML 문법상 문제 없음(`RESOLUTION.md`가 `yaml.safe_load` 로 확인). 다만 대응하는 살아있는 설정이 없는 채로 다음 사람이 이 파일을 다시 열 때까지 방치되면, 이 블록 자체가 다시 낡을 수 있다.
  - 제안: 지금 당장 조치는 불필요. 다음에 이 파일을 편집할 기회가 생기면 이 두 블록(특히 75-81줄)이 여전히 유효한지(가드·`--strict-peer-dependencies` 상태) 재확인하고 필요시 더 축약할 것 — plan 문서(`deps-peer-gating-and-eslint10.md`)에 이미 유사 취지의 후속이 기록돼 있으므로 새 항목을 만들 필요는 없다.

## 그 외 관점별 평가 (문제 없음 — 근거 포함)

- **이전 라운드 CRITICAL 정정 확인**: 같은 PR의 직전 `/ai-review`(`review/code/2026/08/28/11_45_02/documentation.md`)가 지적한 Critical — `PROJECT.md:57`이 "eslint-plugin-unicorn 포함 2건"이라는 낡은 개수를 담고 있던 문제 — 는 이번 라운드에서 실제로 해소됐다. `git diff origin/main...HEAD -- PROJECT.md` 로 직접 확인한 결과, "현재 `typescript`·`eslint-plugin-unicorn` 2건" → "현재 `typescript` 1건"으로 정정됐고, `eslint-plugin-unicorn` 근거 문단은 삭제 대신 원문을 취소선(`~~...~~`)으로 남긴 채 "역사적 각주"로 격하되었으며 2026-08-28 전제 소멸 사실과 재발 방지 가드(`eslint-unicorn-peer.spec.ts` + CI `--strict-peer-dependencies`)를 덧붙였다. `.github/dependabot.yml`의 실제 `ignore:` 항목 수(1건)와도 일치한다. 재발 없음.
- **독스트링/JSDoc**: `parseGteFloor`(`eslint-unicorn-peer-guard.ts`)와 `readInstalledPackageJson`(`eslint-unicorn-peer.spec.ts`) 모두 "왜 필요했는지"를 2026-08-28 실측(구체적 실패 사례·에러 메시지)과 함께 갱신/신설했다. 코드(정규식 확장, `exports` 맵 우회)와 JSDoc 서술이 정확히 대응한다.
- **README**: devDependency 툴체인(eslint) 버전 상향뿐이며 루트 `README.md`의 Node 요구사항과 무충돌. 갱신 불요.
- **API 문서**: API 엔드포인트·계약 변경 없음. 해당 없음.
- **주석 정확성**: 직접 소스를 열어 대조 검증한 결과 어긋난 주석 없음.
  - `ai-turn-executor.ts` — `finalSystemPrompt` 재할당 제거 자리에 남긴 "아래 경로는 `messages`만 소비" 주석을 `grep`으로 검증. 이후 스코프에서 그 지역 변수가 실제로 다시 참조되지 않는다(1583~2043행 범위, 두 지점 모두 확인).
  - `codebase/backend/eslint.config.mjs` — registry 실측 표(`66+=>=10.4`)·SoT 참조(`dependabot.yml`이 이 표를 참조만 함)가 실제 `dependabot.yml`/plan 문서와 상호 정합. 3곳에 흩어진 값이 서로 어긋나지 않음을 교차 확인했다.
  - `text-chunker.ts` — 제거된 `overlapBuffer = getOverlapText(...)` 대입 자리의 "forceSplitAndPush가 자체적으로 overlap을 처리한다" 주석은 `forceSplitAndPush` 시그니처에 overlap 파라미터가 없고 바로 다음 줄에서 무조건 `overlapBuffer = ''`로 재대입됨을 확인해 정확함을 검증.
- **인라인 주석**: `secret-resolver.service.ts`의 `eslint-disable-next-line preserve-caught-error`는 (a) 왜 이 지점만 규칙을 끄는지에 대한 5줄 사유 주석과 (b) 저장소 관행(`code.handler.ts` 등)과 동일한 `-- <사유>` 인라인 형식을 **이미 함께 갖추고 있다** — 즉 직전 라운드(`11_45_02`)에서 별도로 지적됐던 스타일 비일관 항목도 이번 diff의 현재 상태에서는 반영 완료로 확인됨(`RESOLUTION.md` #5).
- **변경 이력(CHANGELOG)**: `CHANGELOG.md`는 사용자/운영 영향이 있는 항목만 기록하는 확립된 컨벤션이다(현재 30개 `## Unreleased` 항목 전부 "운영 영향" 서술 포함). 이번 PR은 devDependency·lint 툴체인 상향과 그로 인한 내부 lint 준수 리팩터(`cause: err` 추가 포함, 외부 응답 `.message` 표면은 불변)일 뿐 사용자 관측 가능한 동작 변화가 없어 CHANGELOG 갱신 불요 — 실제로 갱신되지 않은 것이 컨벤션과 정합한다.
- **설정 문서**: 신규 환경변수 없음. `frontend`/`channel-web-chat`이 eslint 9에 남는 이유(상류 `eslint-plugin-react`/`jsx-a11y`/`import`의 peer 실측, 해제 조건)가 각 `eslint.config.mjs` 헤더에 SoT로 명시돼 있고, `plan/in-progress/deps-peer-gating-and-eslint10.md`가 실행 결과·registry 실측 표·`--strict-peer-dependencies` 로 관측 후 되돌린 근거·후속 백로그(§3 frozen 게이트 사각지대)까지 기록했다. `PROJECT.md`도 동일 커밋에서 동기화됨을 확인.
- **예제 코드**: `eslint-unicorn-peer.spec.ts`에 자릿수 형태별 회귀 케이스(`>=10.4`/`>=9.18`/`>=9`/`>=10`, 무효 케이스 `'>='`/`'>=x'`)와 eslint 10 상향 전/후 상태를 나란히 대조하는 분기 판별(discriminating) 테스트가 추가되어 "이 파서가 왜 이렇게 동작해야 하는가"를 실행 가능한 예제로 고정했다.

## 요약

이번 PR(eslint 9→10 + eslint-plugin-unicorn 56→73 상향 및 연쇄 lint 대응)의 문서화 수준은 이 저장소의 "주석은 SoT, 근거·실측·날짜와 함께" 관행을 충실히 따른다. 특히 이번 라운드에서 주목할 점은, 직전 `/ai-review`가 지적한 유일한 Critical(`PROJECT.md`의 2-place 편집 계약 위반 — dependabot ignore 카운트 미갱신)이 실제로 정정 커밋(`0f3b3e0c3`)으로 해소되었음을 소스 대조로 직접 확인했다는 것이다. `dependabot.yml`·양쪽 `eslint.config.mjs`·repo-guard 테스트/JSDoc·plan 문서 모두 값 변경과 근거 주석을 같은 커밋에서 동기화했고, 교차 참조(SoT 지정으로 중복 기재 회피)도 일관되게 유지된다. 새로 발견된 것은 INFO 1건 — 제거된 dependabot ignore 항목 자리에 남은 두 개의 "묘비" 주석 블록이 문법적으로는 문제없지만 대응하는 살아있는 설정 없이 방치될 경우 다음 janitorial pass의 대상이 될 수 있다는 관찰 — 뿐이며, 지금 병합을 막을 이유는 없다.

## 위험도

NONE
