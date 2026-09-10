# 보안(Security) 코드 리뷰

## 리뷰 범위

본 변경은 애플리케이션 로직이 아니라 **의존성 버전 상향(취약점 패치) + 거버넌스 설정 동기화**다.

- `CHANGELOG.md`, `plan/in-progress/deps-audit-floor-refresh-2026-09.md` — 문서
- `codebase/backend/package.json`, `codebase/channel-web-chat/package.json`, `codebase/frontend/package.json` — 직접 의존 버전 상향 4건
- `pnpm-lock.yaml` — lockfile 재해소 (override 상향 8건 + 신설 1건 반영, 중복 제거 동반)
- `pnpm-workspace.yaml` — `overrides` 바닥 상향 8건 + 신설(`qs`) 1건
- `scripts/check-pnpm-security-config.py` — `EXPECTED_OVERRIDES` baseline 동반 갱신

### 발견사항

- **[INFO]** 의존성 취약점 패치 자체는 OWASP A06(취약/오래된 구성요소) 대응으로 타당하고 완결적으로 배선되어 있음을 실측으로 확인
  - 위치: `pnpm-workspace.yaml` (전체 파일, `overrides` 블록), `scripts/check-pnpm-security-config.py:37`(`EXPECTED_OVERRIDES`), `pnpm-lock.yaml` (`overrides:` 헤더, 12~41행 부근)
  - 상세: 이 worktree 에서 직접 재실행해 독립 검증했다 — `pnpm audit --audit-level=moderate` → `No known vulnerabilities found`(exit 0), `python3 scripts/check-override-floors.py` → `OK: override 대상 30개 패키지 중 취약 재유입 0건`(exit 0), `python3 scripts/check-pnpm-security-config.py` → `OK: overrides 33건(값 포함) · onlyBuiltDependencies 5건 · ignoreCves 0건 baseline 일치`(exit 0). `scripts/check-pnpm-security-config.py` 의 `auditConfig.ignoreCves` 는 이번 diff 에서 **변경되지 않았다**(`git diff` 확인) — 즉 신규 CVE 를 "수용" 처리로 조용히 무력화하는 우회가 없다. 이는 audit 실패를 가장 쉽게 숨길 수 있는 레버인데, 그 경로가 건드려지지 않았다는 점이 이 PR 이 실제로 취약점을 고쳤음(회피하지 않았음)을 뒷받침한다.
  - 제안: 없음 — 현재 상태 유지

- **[INFO]** `js-yaml` scoped override 의 "키 상한도 함께 넓혀야 한다" 는 함정을 정확히 처리함
  - 위치: `pnpm-workspace.yaml:96-101`(diff 게이트 기준), `scripts/check-pnpm-security-config.py:65-67`
  - 상세: 값만 `^4.3.2`/`^3.15.2` 로 올리고 키 상한(`<4.3.1`/`<3.15.1`)을 그대로 두면 취약 버전(4.3.1/3.15.1)이 override 스코프 밖에 남아 override 가 적용되지 않는 실질적 함정이 있다(이 저장소가 `#1038` 에서 이미 한 번 겪은 형태라고 커밋 메시지/plan 에 기재). 이번 변경은 키(`<4.3.2`/`<3.15.2`)와 값을 함께 올려 그 함정을 회피했다. `pnpm-lock.yaml` 의 `overrides:` 블록도 동일하게 반영돼 3곳(설정·baseline·lockfile)이 일치한다.
  - 제안: 없음 — 향후 scoped override 를 다시 만질 때도 이 패턴(키+값 동시 상향)을 재사용할 것

- **[INFO]** `qs` 신규 override 가 부모 선언 범위를 깨지 않음을 확인
  - 위치: `pnpm-workspace.yaml`(신설 override, diff 게이트 92-94행 부근), `pnpm-lock.yaml`(`packages:` 블록 내 `qs` 관련 엔트리)
  - 상세: `qs: ^6.16.0` 이 `express@5.2.1`(prod, `qs: ^6.14.0`)과 `superagent`(dev, `qs: ^6.14.1`) 양쪽의 선언 범위를 만족하므로, override 가 상위 패키지의 semver 계약을 깨고 강제 해소하는 형태가 아니다. 프로덕션 경로(`express > qs`)가 존재하므로 `auditConfig.ignoreCves` 로 수용 처리하지 않고 실제로 override 로 패치한 판단도 타당하다(GHSA-4mjr-xmp4-gh2g · GHSA-x5fp-wj9c-mxmx).
  - 제안: 없음

- **[INFO]** `next` critical CVE 2건(GHSA-p293-qw3h-jr36 · GHSA-2xp9-vwfh-vxw4) 패치가 두 워크스페이스(frontend·channel-web-chat) 양쪽에 일관되게 적용됨
  - 위치: `codebase/frontend/package.json:52`, `codebase/channel-web-chat/package.json:17`, `pnpm-lock.yaml`(두 importer 블록의 `next` specifier/version)
  - 상세: 두 워크스페이스가 같은 `next` lockfile 엔트리를 공유하는 구조에서 한쪽만 올리면 재해소 시 되돌아온다는 지적이 정확하며, 실제로 diff 상 양쪽 모두 `^16.2.12 → ^16.3.3` 으로 상향되어 있다. `pnpm-lock.yaml` 상 실제 해소 버전은 `16.3.4`(specifier `^16.3.3` 범위 내)로 두 importer 모두 동일하게 반영됨을 확인.
  - 제안: 없음

- **[INFO]** 하드코딩 시크릿/인증/인젝션/에러 노출 관점에서 해당 없음
  - 위치: 리뷰 대상 8개 파일 전체
  - 상세: 이번 diff 는 패키지 버전 문자열, lockfile 해시/버전, 문서, 파이썬 딕셔너리 리터럴(버전 문자열)만 변경한다. 신규 실행 코드 경로·API·사용자 입력 처리 로직이 없어 인젝션/인증/암호화/에러 처리 관점의 공격 표면 자체가 이번 diff 에는 생기지 않는다.
  - 제안: 없음

### 요약

이번 변경은 취약한 패키지 버전을 고치는 **보안 리미디에이션 PR** 이며, 코드 로직 변경이 없어 통상적인 인젝션·인증·시크릿·에러노출 리스크는 해당 사항이 없다. 핵심 검증 포인트인 override 바닥 상향·신설·직접 의존 상향이 `pnpm-workspace.yaml` / `scripts/check-pnpm-security-config.py`(EXPECTED_OVERRIDES) / `pnpm-lock.yaml` 3곳에 정합되게 반영되어 있고, `auditConfig.ignoreCves` (audit 실패를 숨길 수 있는 가장 강력한 레버)는 건드리지 않았음을 diff 로 확인했다. 이 worktree 에서 `pnpm audit --audit-level=moderate` · `check-override-floors.py` · `check-pnpm-security-config.py` 를 직접 재실행해 모두 exit 0 임을 독립적으로 재검증했다. js-yaml scoped override 의 "키 상한 동반 상향" 처리와 `qs`/`next` override 가 상위 패키지 semver 계약을 깨지 않는지에 대한 근거도 diff 상에서 확인 가능하며 타당하다. Critical/Warning 급 결함 없음.

### 위험도

NONE
