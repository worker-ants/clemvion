# 의존성(Dependency) Review

## 리뷰 대상

- `codebase/frontend/package.json` (전체 파일 컨텍스트만 제공, unified diff 섹션 없음)
- git 이력으로 실제 변경분을 직접 확인: 커밋 `66e574209` "fix(deps): postcss 보안 bump 복원" — `postcss` 의존성 사양을 `^8.5.14` → `^8.5.18` 로 복원하는 1줄 변경 (`codebase/frontend/package.json`, 1 insertion / 1 deletion). `pnpm-lock.yaml` 은 diff 0줄(이미 `^8.5.18` 로 해소돼 있었음).

## 발견사항

- **[CRITICAL]** `postcss` 보안 bump 복원이 부분적 — 같은 CVE 에 취약한 두 번째 postcss 인스턴스가 CI audit 게이트를 미통과 상태로 남아있음
  - 위치: `codebase/frontend/package.json:34` (`"@tailwindcss/postcss": "^4.2.2"`, 이번 diff 로 손대지 않은 인접 의존성) — 이번 diff 의 실제 변경 라인은 `codebase/frontend/package.json:52` (`"postcss": "^8.5.18"`)
  - 상세:
    - 이번 1줄 변경은 `postcss` **직접** 의존성 사양을 `^8.5.14` → `^8.5.18` 로 되돌려 `pnpm-lock.yaml` 의 importer specifier(이미 `^8.5.18`)와 재정합시킨다 — 커밋 메시지대로 `--frozen-lockfile` 실패(`ERR_PNPM_OUTDATED_LOCKFILE`)를 고치는 것이 목적이며, 이 경로(직접 `postcss`, `next>postcss` 오버라이드 경유)는 lockfile 상 이미 `postcss@8.5.25` 로 해소돼 있어 실제 설치 버전 회귀는 없었다. `^8.5.14`→`^8.5.18` 는 이 저장소가 겪은 실제 CVE 인 GHSA-r28c-9q8g-f849("PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure", HIGH, CVSS 3.1 7.5, 2026-07-24 공개, `postcss<=8.5.17` 취약·`>=8.5.18` 패치)를 겨냥한 것으로 OSV.dev 조회로 직접 확인했다(8.5.14/8.5.15 취약, 8.5.18 이상 클린).
    - 그런데 같은 워크스페이스 안에 **동일 CVE 에 취약한 두 번째 postcss 해소분**이 남아있다: `codebase/frontend` → `@tailwindcss/postcss@^4.2.2`(lockfile 해소 `4.3.1`) → `@tailwindcss/postcss@4.3.1` 자신의 package.json 이 `"postcss": "8.5.15"` 를 **caret 없이 정확히 고정**한다(npm registry 직접 조회로 확인 — 업스트림이 4.2.x/4.3.0/4.3.2+ 에서는 `^8.5.x` caret 을 쓰다가 4.3.1 릴리스에서만 일시적으로 caret 을 빠뜨렸다). `postcss@8.5.15` 는 GHSA-r28c-9q8g-f849 의 취약 범위(`<=8.5.17`)에 그대로 해당해 **여전히 취약**하다.
    - 이 저장소의 실제 `pnpm-lock.yaml` 을 대상으로 로컬에서 `pnpm audit --audit-level=moderate` 를 직접 실행해 재현·확인했다. 결과에 다음 항목이 그대로 포함된다:
      ```
      high | PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure
      Package: postcss
      Vulnerable versions: <=8.5.17
      Patched versions: >=8.5.18
      Paths: codebase__frontend>@tailwindcss/postcss>postcss
      More info: https://github.com/advisories/GHSA-r28c-9q8g-f849
      ```
    - `pnpm-workspace.yaml` 의 `auditConfig.ignoreCves` 에는 이 GHSA/CVE 에 대한 검토·수용 등재가 없다(현재 유일 등재는 `CVE-2026-53550`/js-yaml). `PROJECT.md` §의존성 취약점 audit·핀 거버넌스는 "검토 후 수용하는 취약점은 ignoreCves 에 사유·영향경로·해소조건 주석과 함께 등재"·"신규 CVE 를 사유 없이 억제 금지"를 명시하며, CI(`.github/workflows/deps-security-checks.yml`)가 `pnpm audit --audit-level=moderate` 로 미등재 moderate+ 를 차단하도록 규정한다. 이 워크플로는 `codebase/**/package.json` 변경 시 PR 에서 트리거되도록 설정돼 있고, 이번 diff 가 정확히 `codebase/frontend/package.json` 을 건드리므로 **이 PR 자체가 그 audit 게이트를 다시 유발하며, 위 HIGH 발견 때문에 통과하지 못할 가능성이 높다**.
    - 부수적으로, `pnpm-workspace.yaml:40` 의 기존 오버라이드 `next>postcss: ^8.5.14` (및 `scripts/check-pnpm-security-config.py` 의 `EXPECTED_OVERRIDES["next>postcss"]`)도 이번 직접 의존성 하한(`^8.5.18`)과 표현이 어긋난 채 남아있다. 오늘은 우연히 `postcss@8.5.25` 로 해소돼 실질적 위험은 없지만, 이 하한이 취약 구간(`8.5.14`~`8.5.17`) 안에 있다는 점에서 향후 재해소 시 드리프트 여지를 닫아두지 못했다.
    - 이 갭은 이번 diff 가 새로 만든 회귀가 아니다 — `@tailwindcss/postcss` 버전은 diff 전후로 불변이며 `origin/main` 에도 동일하게 존재한다(diff 전체가 `postcss` 한 줄 + 무관한 backend/e2e 변경뿐임을 `git diff origin/main...HEAD` 로 확인). 다만 이번 diff 가 정확히 "postcss 보안 bump 복원"을 표방하는 커밋이라는 점에서, 그 목표가 부분적으로만 달성됐다는 사실은 이 리뷰의 핵심 발견으로 반드시 표면화돼야 한다.
    - 참고(완화 요인): `@tailwindcss/postcss` 는 Next.js 빌드타임에 저장소 자체 CSS(tailwind 지시자)만 컴파일하는 build-tool 성격이라, "공격자가 제어하는 CSS 를 신뢰 경계 안에서 파싱"하는 런타임 노출 시나리오는 이 배포 컨텍스트에서 관측되지 않는다 — 이 저장소가 `CVE-2026-53550`(gray-matter→js-yaml)에 이미 적용한 것과 같은 판단 축이다. 그럼에도 (a) CI 의 `pnpm audit` 게이트가 절차상 차단 대상이고 (b) 프로젝트 자신의 거버넌스 규약(사유 없는 억제 금지)상 미등재 상태로 방치할 수 없다는 점은 실사용 위험도와 무관하게 그 자체로 정정이 필요하다.
  - 제안:
    1. `codebase/frontend/package.json` 의 `@tailwindcss/postcss` 를 caret 이 복원된 상위 버전으로 올린다(예: `^4.3.2` 이상 — 4.3.2 는 `postcss: ^8.5.15`, 최신 `4.3.3` 은 `postcss: ^8.5.16` 로 caret 회귀가 이미 해소됨). 이후 `pnpm install` 로 lockfile 을 갱신해 `postcss@8.5.15` 스냅샷을 제거.
    2. 또는(병행 가능) `pnpm-workspace.yaml` 의 `overrides` 에 `"@tailwindcss/postcss>postcss": "^8.5.18"`(혹은 전역 `postcss: ^8.5.18`)를 추가한다. 이 경우 `PROJECT.md` 규약(2-place 편집)에 따라 `scripts/check-pnpm-security-config.py` 의 `EXPECTED_OVERRIDES` 도 **동시에** 갱신해야 config-guard 가 "무단 추가"로 오탐하지 않는다.
    3. 어느 쪽이든 조치 후 `pnpm audit --audit-level=moderate` 를 재실행해 GHSA-r28c-9q8g-f849 가 더 이상 보고되지 않음을 확인한다.
    4. 부수 정합성: `next>postcss` 오버라이드도 `^8.5.18` 로 함께 올려(`pnpm-workspace.yaml` + `check-pnpm-security-config.py` 2-place) 표현 하한을 직접 의존성과 맞춘다.
    5. 위 조치가 이번 PR 범위를 벗어난다고 판단되면, 최소한 `pnpm-workspace.yaml` 의 `auditConfig.ignoreCves` 에 GHSA-r28c-9q8g-f849(또는 대응 CVE) 를 사유·영향경로("빌드타임 전용, 신뢰 CSS 입력만 처리")·해소조건과 함께 명시 등재해 CI 게이트를 의도적으로 통과시키고 추적 가능하게 만든다.

- **[INFO]** 이번 변경 자체는 버전 고정 정책 위반 없음
  - 위치: `codebase/frontend/package.json:52`
  - 상세: `^8.5.14` → `^8.5.18` 은 caret 범위를 유지한 하한 상향으로, `PROJECT.md` §버전 핀 정책 (a) 기본 caret 원칙에 부합한다. exact/tilde 핀이 아니므로 `//pin` 사유 주석 대상도 아니다. 새 외부 패키지 추가·라이선스 변경·기존 의존성과의 semver 비호환(peer range 등)도 없음을 `postcss-unique-selectors@7.0.7` 의 `peerDependencies: postcss ^8.5.13` 등으로 확인했다(8.5.18/8.5.25 모두 충족).
  - 제안: 없음(정상).

## 요약

리뷰 대상 diff 자체(`postcss` 직접 의존성 `^8.5.14`→`^8.5.18`)는 새 의존성 도입도, 버전 고정 정책 위반도, 라이선스 리스크도 없는 정상적인 1줄 lockfile-정합성 수정이며, 이 경로가 가리키는 실제 설치 버전(8.5.25)은 이미 패치돼 있다. 그러나 이 diff 가 명시적으로 표방하는 "postcss 보안 bump 복원"이라는 목표는 **부분적으로만 달성**됐다 — `codebase/frontend > @tailwindcss/postcss@4.3.1 > postcss@8.5.15`(업스트림이 caret 없이 고정)라는 동일 CVE(GHSA-r28c-9q8g-f849, HIGH/CVSS 7.5, PostCSS sourceMappingURL 경로순회→임의 `.map` 파일 노출) 취약 인스턴스가 이 저장소에 그대로 남아있음을 OSV.dev 조회·npm registry 조회·로컬 `pnpm audit --audit-level=moderate` 실행(3가지 독립 방법)으로 확인했다. 이 갭은 diff 가 새로 만든 회귀는 아니고 `origin/main` 에도 이미 존재하지만, `deps-security-checks.yml` 이 `codebase/**/package.json` 변경 시 트리거되도록 구성돼 있어 이 PR 이 정확히 그 audit 게이트를 재유발하며, `pnpm-workspace.yaml` 의 `ignoreCves` 에 등재되지 않은 채로는 프로젝트 자신의 거버넌스 규약상으로도 방치할 수 없는 상태다. 병합 전에 `@tailwindcss/postcss` 상향(또는 스코프 오버라이드 추가 + `check-pnpm-security-config.py` 동기화) 또는 최소한 `ignoreCves` 명시 등재 중 하나가 필요하다.

## 위험도

CRITICAL
