# 테스트(Testing) 리뷰 — mermaid-lint undici/dompurify 취약점 fix + 마커 lockfile-해시 결속

대상 diff: `22cc48ef3..HEAD` (`.claude/tools/bootstrap-session.sh`, `.claude/tests/test_bootstrap_mermaid_install.py`, `.github/dependabot.yml`, `.claude/tools/mermaid-lint/package-lock.json`, `PROJECT.md` 1문장). 핵심 변경은 review 12_06_58 W1(설치완료 마커가 lockfile 과 무관해 보안 패치가 기존 checkout 에 전파되지 않던 결함)의 fix — 마커 content 를 lockfile sha256 해시로 바꾸고 불일치 시 재설치.

## 검증 수행 내역 (empirical)

- `python3 -m unittest discover -s .claude/tests -p 'test_bootstrap_mermaid_install.py'` (CI 의 `harness-checks.yml` 과 동일 호출) 로 9개 테스트(기존 7 + 신규 2) 전부 통과 확인.
- fix 이전 커밋(`02d69e324`)의 `bootstrap-session.sh` 로 스크립트를 일시 교체해 같은 스위트를 재실행 → 신규 테스트 `test_lockfile_change_retriggers_install` 이 정확히 레드로 실패(`AssertionError: '' == '' : marker must record the lockfile hash, not be empty`)함을 확인 후 원본으로 복원(작업트리 clean, `git diff --exit-code` 0 확인). 신규 테스트가 비-vacuity 함을 직접 실증.
- `_lock_hash()` 가 의존하는 해싱 도구 부재 폴백(`shasum`/`sha256sum` 둘 다 없을 때) 및 npm install 이 lockfile 자체를 재작성하는 시나리오를 스크래치 디렉터리에서 직접 재현 — 아래 WARNING #1, #2 근거.

## 발견사항

- **[WARNING]** `_lock_hash()` 의 "해싱 도구 부재" 폴백 분기가 완전히 무테스트 — 실측 결과 이 PR 이 고치려는 W1 결함을 그대로 재현
  - 위치: `.claude/tools/bootstrap-session.sh:96-103`(`_lock_hash`), `:112-123`(`want_hash`/`need_install` 산출) / `.claude/tests/test_bootstrap_mermaid_install.py` 전체(해당 분기를 겨냥한 테스트 없음)
  - 상세: `shasum`과 `sha256sum` 이 둘 다 PATH 에 없으면 `_lock_hash()`가 빈 문자열을 반환하고, `[ -n "$want_hash" ]` 가드(L120)가 거짓이 되어 해시 불일치 검사 전체가 비활성화된다 — 코드 주석이 이를 "presence-only 폴백, 구 동작 보존"으로 명시한 의도된 분기다. 그런데 테스트 스위트는 `npm`만 PATH 에서 스텁하고(`_env()`), 해싱 도구는 항상 실제 바이너리를 그대로 쓰므로 이 분기는 어떤 테스트에서도 실행되지 않는다. 로컬에서 `shasum`/`sha256sum` 을 `exit 127` 스텁으로 가려 재현한 결과: ① 최초 설치는 정상 진행되나 마커가 빈 문자열로 기록되고, ② 이후 lockfile 을 실제로 변경해도(보안 범프와 동일 시나리오) 재설치가 트리거되지 않음(3회 연속 실행에도 npm 호출 1회 고정)을 확인했다. 즉 이 분기는 "해싱 도구가 없는 호스트"라는 조건에서 W1 과 동일한 실패 모드(마커가 존재만 하면 보안 패치가 영구히 전파되지 않음)를 그대로 재현하며, 이번 fix 의 존재 이유와 정확히 같은 결함 클래스를 무방비로 남겨둔다. macOS(perl `shasum`)·Ubuntu CI(GNU `sha256sum`) 등 이 프로젝트의 실제 대상 환경에서는 발생 확률이 낮지만, 코드가 이 분기를 명시적으로 설계·주석화했음에도 회귀 테스트가 전혀 없다.
  - 제안: 기존 `npm` 스텁과 동일한 PATH-shadow 패턴으로 `shasum`/`sha256sum` 을 `exit 127` 스텁 처리하는 테스트를 추가해 "해싱 도구 부재 시 최초 설치는 되지만 이후 lockfile 변경은 감지되지 않는다(의도된 열화)"를 명시적으로 pin. 최소한 이 제약이 코드 주석에만 머물지 않고 테스트로 뒷받침되도록 권장.

- **[WARNING]** npm 스텁이 `package-lock.json` 을 전혀 건드리지 않아 "npm install 이 lockfile 자체를 재작성"하는 실제 시나리오를 mock 이 검증하지 못함 (mock 충실도 갭)
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:41-46`(`_NPM_STUB`, `node_modules/somedep` 생성만 하고 lockfile 무변경) / `.claude/tools/bootstrap-session.sh:115`(`want_hash=$(_lock_hash)` 를 `npm install` **실행 이전** 시점에 캡처) + `:127-128`(설치 성공 시 이 사전-캡처 값을 마커에 기록)
  - 상세: 마커에는 install **이전** 시점의 lockfile 해시가 기록된다. 그런데 실제 `npm install` 은 (lockfileVersion 마이그레이션, `resolved`/`packages` 필드 정규화 등 npm 버전 간 잘 알려진 동작으로) 설치 도중 `package-lock.json` 자체를 다시 쓸 수 있다 — 이 트리의 `package.json` 이 `"jsdom": "*", "mermaid": "*"` 로 미고정인 점도 재해석 여지를 늘린다. npm 스텁을 "설치 후 lockfile 에 개행 1바이트 추가"(=사소한 재작성 모델링)로 바꿔 로컬 재현한 결과, 연속 3회 세션 실행 모두 매번 재설치가 트리거됨을 확인했다(npm 호출 1→2→3, 결코 수렴하지 않음). 이는 `test_unchanged_lockfile_does_not_reinstall` 이 보장한다고 주장하는 핵심 불변식("lockfile 불변 시 매 SessionStart 재설치되지 않는다")이, 스텁의 충실도 부족으로 인해 실제 npm 환경에서는 증명되지 않은 채 green 처리되고 있음을 뜻한다. 최악의 경우 이번 fix 가 "설치 1회"를 "매 세션 재설치"로 퇴행시켜 모든 SessionStart 에 `npm install` 지연을 추가하는 방향(보안 노출이 아닌 성능/UX 퇴행)으로 실패할 수 있다.
  - 제안: `_NPM_STUB` 에 설치 후 lockfile 을 사소하게 변형하는 옵션(예: `NPM_STUB_TOUCHES_LOCKFILE=1`)을 추가하고, 연속 실행에도 npm 호출이 발산하지 않는지 검증하는 테스트를 검토. 근본적으로는 `want_hash` 를 install **이전**이 아니라 **설치 성공 직후 재계산**해 마커에 쓰도록 바꾸면 이 문제 자체가 사라진다 — 다만 이는 코드 쪽 수정 제안으로 Testing 리뷰 범위를 다소 벗어나므로 참고용.

- **[INFO]** `.github/dependabot.yml` 신규 npm ecosystem 항목·`PROJECT.md` 산문 1문장은 자동 검증 테스트 없음 — 기존 관례와 일치, 결함 아님
  - 위치: `.github/dependabot.yml:17-20`, `PROJECT.md:48`
  - 상세: 두 변경 모두 harness 테스트/가드 대상이 아니다. `dependabot.yml` 은 기존 `github-actions` 항목도 검증 테스트가 없는 선례와 일치하며, YAML 자체는 `yaml.safe_load` 로 직접 파싱해 문법 정상 확인했다. `PROJECT.md` 산문 추가는 `test_doc_sync_matrix.py` 가 지키는 "변경 유형→갱신 위치" 표 구조 밖의 자유 서술이라 가드 대상이 아니다.
  - 제안: 없음(정보성, 신규 조치 불필요).

- **[INFO]** 신규 테스트 2건은 명확하고 최소한의 범위로 핵심 불변식 양방향(변경→재설치 / 불변→skip)을 정확히 pin — 가독성·의도 표현 양호
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:155-184`
  - 상세: `_write_lock` 헬퍼로 시나리오 셋업이 간결하고, docstring 이 "W1"·"the other half" 로 두 테스트의 관계를 명시해 의도가 뚜렷하다. `setUp`/`addCleanup` 기반 임시 디렉터리 격리, `_env()` 를 통한 스로틀 기본값(0) 중앙화로 테스트 간 flake 가능성도 낮다. 기존 7개 테스트도 새 `need_install` 로직 하에서 수정 없이 그대로 유효함(회귀 없음, 직접 실행 확인).
  - 제안: 없음(강점 기록).

## 요약

이번 diff 의 헤드라인 목표 — "마커가 lockfile 해시와 결속돼 보안 범프가 기존 checkout 에도 전파된다" — 는 신규 테스트 2건이 정확하고 비-vacuity 하게(fix 이전 코드에 대해 레드로 실패함을 직접 확인) 증명하며, 기존 7개 회귀 테스트도 CI 와 동일한 호출로 전부 통과해 깨진 곳이 없다. 다만 코드 자체가 명시적으로 설계한 두 개의 분기 — ① 해싱 도구 부재 시 presence-only 폴백, ② `npm install` 이 lockfile 을 사전-캡처 시점 이후 재작성하는 경우 — 는 어떤 테스트도 다루지 않으며, 둘 다 로컬 재현으로 실제 결함(각각 "W1 과 동일한 무신호 잔존", "매 세션 재설치로 발산")임을 확인했다. 특히 ①은 이번 PR 이 없애려는 바로 그 실패 모드를 다른 전제 조건 아래 되살린다는 점에서 아이러니하고, ②는 npm 스텁이 실 npm 의 lockfile-재작성 가능성을 전혀 모델링하지 않는 mock 충실도 문제다. 둘 다 발생 조건이 좁아(실사용 환경에서 드묾) 병합을 막을 사유는 아니지만, 후속 테스트로 pin 해두는 것을 권장한다.

## 위험도

MEDIUM
