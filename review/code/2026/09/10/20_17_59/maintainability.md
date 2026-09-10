# 유지보수성(Maintainability) 코드 리뷰

## 변경 개요

이번 PR 은 실질적으로 **의존성 버전 상향 + 그 근거 기록**으로 구성된다: `pnpm-workspace.yaml` 의 override 바닥
갱신, `codebase/{backend,frontend,channel-web-chat}/package.json` 직접 의존 선언 상향, `pnpm-lock.yaml`
재해소, `scripts/check-pnpm-security-config.py` 의 `EXPECTED_OVERRIDES` baseline 동반 갱신, `CHANGELOG.md` ·
`plan/in-progress/deps-audit-floor-refresh-2026-09.md` 문서화. 새로 작성된 애플리케이션 로직은 없고
`check-pnpm-security-config.py` 는 상수 딕셔너리 값만 바뀌었다(제어 흐름 변경 없음). 따라서 함수 길이·중첩
깊이·순환 복잡도 관점에서 검토 대상 자체가 거의 없다.

## 발견사항

- **[INFO]** `CHANGELOG.md` 표의 "→" 열이 두 행에서만 `키: 값` 복합 문자열을 담아 다른 행과 열 의미가 어긋난다
  - 위치: `CHANGELOG.md:38`, `CHANGELOG.md:39`
  - 상세: "바닥 침식" 표(`CHANGELOG.md:30`)의 헤더는 `| 패키지 | 바닥 | → | 근거 |` 이고, `fast-uri`·`hono`·
    `multer`·`nodemailer`·`sharp`·`svgo` 6개 행은 "→" 열에 **버전 값만** 담아 헤더 의미를 그대로 따른다.
    그런데 `js-yaml` 두 행만 "→" 열에 `` `js-yaml@>=4.0.0 <4.3.2`: `^4.3.2` `` 처럼 override 키 전체를
    다시 적어 넣었다(override 키 자체의 상한이 함께 바뀌어야 해서다). 표를 훑는 독자는 "→" 열이 항상
    단순 버전 문자열이라고 기대하다가 이 두 행에서만 형식이 바뀌는 것을 마주치게 된다. 같은 정보를 담은
    `plan/in-progress/deps-audit-floor-refresh-2026-09.md` 의 동일 표(§1(a))는 "필요 하한" 열에 항상
    단순 버전(`>=4.3.2`)만 두고, 키 상한이 함께 바뀐다는 사실은 표 밖의 산문 설명으로 분리해 이 문제를
    피해갔다 — 즉 같은 PR 안에서 이미 더 나은 대안 패턴이 존재한다.
  - 제안: `CHANGELOG.md` 도 plan 문서와 같은 패턴으로 "→" 열은 값만 두고, 키 상한이 함께 넓어진다는 설명은
    표 바로 아래 산문(이미 `CHANGELOG.md:41~43` 에 있음)에만 맡기면 열 의미가 표 전체에서 일관된다. 현재도
    바로 아래 문단이 그 사실을 설명하고 있어 정보 누락은 아니지만, 표 자체의 열 일관성은 어긋나 있다.

- **[INFO]** (긍정적 관찰, 결함 아님) `pnpm-workspace.yaml` override 변경과 `scripts/check-pnpm-security-config.py`
  의 `EXPECTED_OVERRIDES` 갱신이 정확히 동반됐다 — 그 스크립트의 docstring(`scripts/check-pnpm-security-config.py:20-22`)
  이 요구하는 "2-place 편집" 규약을 두 값(`fast-uri`/`hono`/`multer`/`nodemailer`/`svgo`/`sharp`/`qs`/
  `js-yaml` 두 키)까지 정확히 일치시켜 지켰다. 이는 일관성(§8) 관점에서 모범적이라 별도 조치 불요.

## 요약

애플리케이션 코드 변경이 없는 순수 의존성 버전 상향 PR 이라 가독성·네이밍·함수 길이·중첩·매직 넘버·복잡도
관점에서 지적할 대상이 사실상 없다. 유일한 실질적 발견은 `CHANGELOG.md` 요약 표에서 "→" 열의 의미가 두 행만
다르게 쓰여 표 일관성이 약간 흔들린다는 점이며, 정보 자체는 바로 아래 산문으로 보완돼 있어 오독 위험은 낮다.
`pnpm-workspace.yaml`↔`check-pnpm-security-config.py` 2-place 편집 규약은 정확히 지켜졌다.

## 위험도

NONE
