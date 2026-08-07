# 변경 범위(Scope) 리뷰 — 의존성 보안 override 상향 (c8ad8de6b)

## 발견사항

- **[INFO]** override 대상이 아닌 부수 패키지(postcss, nanoid, `@aws-sdk/core` deprecated 배너)가 lockfile 재생성 과정에서 함께 갱신됨
  - 위치: `pnpm-lock.yaml:8600`(`postcss@8.5.26`), `pnpm-lock.yaml:7979`(`nanoid@3.3.17`), `pnpm-lock.yaml:907`(`@aws-sdk/core@3.977.4` 에 `deprecated:` 배너 신규 추가)
  - 상세: 커밋 메시지는 `pnpm install` 재실행 시 발생하는 `libc:` 필드 유실 부작용은 명시적으로 인지하고 diff opcode 로 걸러냈다고 밝히지만, `vite`→`postcss` 체인의 8.5.25→8.5.26, `nanoid` 3.3.16→3.3.17, `@aws-sdk/core` deprecated 배너 추가는 커밋 메시지의 "침식 4종" 목록·검증 절차에 언급되지 않는다. 이 패키지들은 EXPECTED_OVERRIDES 대상도 아니고 CVE 목록에도 없다.
  - 제안: 실제 위험은 낮다 — override 미지정 전이 의존성이 lockfile 재해석 시점에 상류 registry 의 최신 patch 로 자연 이동하는 것은 `pnpm install` 의 일반적 동작이며, 이번 작업의 의도(override 상향)와 인과적으로 분리하기 어렵다. 다만 커밋 메시지의 "이번 변경만 얹었다" 서술이 정확히는 "선택한 override/direct dep 항목 + 그로 인해 함께 움직인 전이 트리" 임을 명확히 하면 향후 감사(audit) 시 혼선을 줄일 수 있다. 차단 사유는 아님.

## 요약

4개 파일(`codebase/backend/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `scripts/check-pnpm-security-config.py`) 모두가 커밋 메시지가 명시한 단일 목적 — override 하한이 낡아 재해소되던 취약 버전 6종(fast-uri/hono/js-yaml×2/undici×2)의 상한 정정, 신규 socket.io-parser override 추가, 그리고 baseline 가드(`check-pnpm-security-config.py`)와의 2-place 동시 갱신 — 에 정확히 대응한다. `pnpm-workspace.yaml`에 추가된 `socket.io-parser: ~4.2.7` 주석은 `^` 대신 `~`를 쓴 이유(부모 socket.io 의 semver 계약 보존)를 근거와 함께 설명하는 실질적 주석이며 불필요한 장식이 아니다. lockfile diff 는 override 변경의 자연스러운 파생 효과(추이 재해석)이고, 직접 관련 없는 코드 리팩토링·포맷팅·기능 확장·무관한 파일 수정은 발견되지 않았다. 유일한 관찰 사항은 lockfile 재생성이 끌고 온 극소수의 비대상 패키지 patch 버전 변경(postcss/nanoid/aws-sdk 배너)이며, 이는 스코프 위반이라기보다 도구(pnpm)의 정상 동작에 가깝다.

## 위험도
NONE
