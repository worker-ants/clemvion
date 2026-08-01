# 요구사항(Requirement) 리뷰 — scripts/check-override-floors.py

## 컨텍스트

본 파일은 이미 4차에 걸친 `/ai-review` (01_56_46 → 02_38_45 → 03_16_51, 각 라운드 Critical/Warning 전건 조치 완료: 4차 결과 Critical 0 · Warning 2, 모두 해소)와 `.claude/tests/test_override_floors.py` 28건(4축 + 회귀 고정 2클래스, mutation 검증)을 거친 상태에서의 5차 리뷰다. 본 라운드에서는 코드를 처음부터 재추적하고, 추가로 **실제 저장소에서 스크립트를 라이브 `pnpm audit`로 직접 실행**해 이론적 우려를 실측으로 검증했다.

### 실측 검증
```
$ python3 scripts/check-override-floors.py
OK: override 대상 26개 패키지 중 취약 재유입 0건 (audit 잔여가 있더라도 그건 override 미관리 패키지 — audit 잡이 담당)
EXIT=0
```
- `override 대상 26개` — `pnpm-workspace.yaml` 의 override 키를 수작업으로 집계(js-yaml 2키·brace-expansion 3키를 각각 1 타겟으로 병합)한 결과와 정확히 일치.
- `pnpm audit --json` 원본을 직접 파싱해 확인: `advisories` 0건, `actions` 1건(`brace-expansion` → `codebase__backend>@eslint/eslintrc>minimatch>brace-expansion`) — 코드의 `EXPECTED_SUPPRESSED_PATHS`(`scripts/check-override-floors.py:65-67`) 값과 정확히 일치. `js-yaml`(override 대상이면서 `ignoreCves`(CVE-2026-53550)로도 걸려 있어 이론상 `widened` 오탐 후보로 검토했던 패키지)은 `actions[]`에 전혀 나타나지 않음 — lockfile 상 gray-matter 경로를 포함해 전역이 이미 패치 버전(3.15.0)으로 해소돼 있어 억제할 대상 자체가 없기 때문. 오탐 없음을 라이브로 확정.

## 발견사항

- **[INFO]** `run_audit()`의 `subprocess.run`에 명시적 `timeout=`이 없다
  - 위치: `scripts/check-override-floors.py:146-151` (`def run_audit()`는 138행)
  - 상세: `pnpm audit --json`이 레지스트리 응답 지연으로 무한 대기(에러 없이 hang)하면 스크립트도 함께 멈춘다. `_undecidable()` 6곳은 모두 "응답은 왔지만 형태가 이상함"을 다루지, "응답 자체가 안 옴"은 다루지 않는다. CI에서는 `.github/workflows/deps-security-checks.yml`의 `override-floors` job `timeout-minutes: 10`이 최종 백스톱이라 안전 불변식(조용한 통과 금지)은 깨지지 않지만, 로컬/수동 실행이나 job timeout 조정 시 무기한 대기로 소진된다. 3차례 리뷰 기록(`review/code/2026/08/01/{01_56_46,02_38_45,03_16_51}/*.md`, 프롬프트 제외)에 동일 지적이 없어 신규 관측으로 판단.
  - 제안: `subprocess.run(..., timeout=120)` 정도를 추가하고 `subprocess.TimeoutExpired`를 `_undecidable()`로 연결하면 나머지 6곳과 동일한 fail-closed 메시지 품질을 갖는다. 사소한 개선이라 이번 라운드 필수 차단 사유는 아님.

- **[INFO]** 스키마 드리프트 방어가 "여섯 곳"으로 명시 고정돼 있으나(`FailClosedSiteCountTest`), `advisories`/`actions`가 dict/list가 아닌 **다른 truthy 컨테이너**(예: 최상위 `actions`가 문자열이거나 dict인 경우)로 오면 그 여섯 곳 밖에서 `AttributeError` 같은 미가공 예외로 죽는다
  - 위치: `scripts/check-override-floors.py:195-196`(`advisories = audit.get("advisories") or {}` / `actions = audit.get("actions") or []`), 소비부 `scripts/check-override-floors.py:199`(`advisories.items()`), `scripts/check-override-floors.py:206`(`[a for a in actions if a.get("module")]`)
  - 상세: 이 형태 변이는 "취약 0건"으로 오인되는 조용한 통과가 **아니라** 예외로 인한 비-0 종료라 스크립트가 막으려는 핵심 위험(조용한 성공)은 재현하지 않는다. 다만 진단 메시지가 `_undecidable()`의 친절한 안내 대신 파이썬 traceback이 된다. plan(`plan/in-progress/deps-guard-hardening.md`)의 "3차 리뷰에서 미조치로 남긴 것" 섹션에 이미 INFO 1·3·6·7·8·11이 유사한 논리(안전 방향이라 우선순위 낮음)로 보류돼 있는 것과 같은 급.
  - 제안: 필수 조치 아님. 향후 스키마 드리프트 형태가 실제로 관측되면 그때 `isinstance` 체크를 추가.

- **[INFO]** spec fidelity — 관련 제품 spec 문서 없음
  - 위치: `spec/` 전체 grep 결과 `override-floors`/`override_floors`/`바닥 침식`/`check-override-floors` 매칭 0건.
  - 상세: `plan/in-progress/deps-guard-hardening.md` frontmatter에 `spec_impact: none`이 명시돼 있고 실제로 이 변경은 CI/의존성 보안 툴링으로 제품 동작 spec과 무관하다(Rationale: "CI·스크립트·설정 변경으로 제품 명세와 무관"). line-level spec-코드 대조 대상 자체가 없음 — 정상.

## 그 외 확인한 항목 (이상 없음)

- **기능 완전성**: `chain_segments`/`override_target`가 문서화된 8가지 override 키 형태(plain·부모-자식·다단 체인·레인지·scope·scope 자식·체인 중간 scope·체인+scope+레인지 조합)를 정확히 처리함을 코드 추적 + `test_override_floors.py::OverrideTargetExtractionTest`(8개 테스트, 실제 `pnpm-workspace.yaml` 대조 포함) 양쪽으로 확인.
- **엣지 케이스**: 빈 overrides, 빈 advisories/actions, 스키마 필드명 변경(camelCase 개명 등), `actions`↔`reported` 전부 겹치는 정상 상태, widened+eroded 동시 발생 — 전부 `SchemaDriftTest`/`CombinedReportTest`/`FailClosedTest`로 커버되고 라이브 실행으로도 확인됨.
- **TODO/FIXME/HACK/XXX**: 0건 (`grep -iE "TODO|FIXME|HACK|XXX"` 매칭 없음).
- **의도와 구현 간 괴리**: 함수명·docstring·실제 동작 완전 일치(`_undecidable`→`NoReturn`+`sys.exit(2)`, `classify_vulnerable`→`(reported, suppressed)` 튜플 반환 계약, `chain_segments`→체인 분할만 수행 등).
- **에러 시나리오**: `_undecidable()` 호출 6곳(빈 출력·JSON 파싱 실패·`actions` 키 부재·`advisories` 하위 필드 드리프트·`actions` 하위 필드 드리프트·워크스페이스 파일 부재) 모두 exit 2로 고정, `FailClosedSiteCountTest`가 소스의 호출 횟수를 세어 docstring/README와의 drift를 자동 차단.
- **데이터 유효성**: override 키 파싱의 구분자(`>`)/레인지(`@`) 판별 규칙이 실제 `pnpm-workspace.yaml`의 모든 키 형태(js-yaml 레인지 2건, brace-expansion 레인지 3건, `@grpc/grpc-js` scope, `next>postcss` 체인, `undici@>=7.0.0 <7.28.0` 레인지)에 대해 라이브 실행으로 정상 분류됨을 확인(override 대상 26개 = 수작업 집계와 일치).
- **비즈니스 로직**: "override 대상이면서 취약 → eroded(판단 불필요, 값만 올림)" vs "override 미대상 취약 → audit 잡 담당(본 가드 범위 밖)" vs "ignoreCves로 억제된 것 중 경로가 늘어난 것만 → widened" 3분류가 `main()`의 `widened`/`eroded` 계산과 정확히 일치. "억제 항목 존재만으로 fail"이 아니라 "경로 확대만 fail"이라는 미묘한 기준도 `EXPECTED_SUPPRESSED_PATHS`와 `extra = actual - allowed` 로직으로 정확히 구현.
- **반환값**: `main()`의 모든 도달 가능 경로가 명시적으로 `int`를 반환하거나(0/1) 그 이전에 `_undecidable()`이 `sys.exit(2)`로 프로세스를 종료함(`NoReturn` 타입으로 누락 방지). `classify_vulnerable`/`run_audit`도 모든 경로에서 선언된 타입에 맞는 값 반환.
- **2-place 편집 규약**: `EXPECTED_SUPPRESSED_PATHS`(본 파일) ↔ `pnpm-workspace.yaml`의 `auditConfig.ignoreCves`, `_report_eroded`의 안내 문구가 가리키는 `check-pnpm-security-config.py`의 `EXPECTED_OVERRIDES` — 현재 세 지점 모두 실제로 정합.

## 요약

`scripts/check-override-floors.py`는 "이미 override로 관리 중인 패키지가 새 CVE로 재취약해졌는지"만 좁혀 검출한다는 의도한 기능을 정확히 구현한다. 8가지 override 키 형태 파싱, widened(수용 범위 밖 재유입)/eroded(바닥 침식) 2분류, 6곳의 fail-closed 판정 모두 코드·테스트(28건, mutation 검증)·docstring이 상호 일치하며, 이번 라운드에서 라이브 `pnpm audit`를 직접 실행해 현재 저장소 상태(override 대상 26개, 오탐 0건)로 재확인했다. `spec_impact: none`이 선언된 순수 CI/툴링 변경이라 적용 가능한 제품 spec 문서가 없다(정상 INFO). 남은 관측사항은 subprocess 무한대기 백스톱 부재(CI job timeout으로 완화됨)와 6곳 밖의 심층 스키마 변이 시 traceback 노출(안전 불변식은 유지됨) 2건으로, 모두 차단 사유가 아닌 경미한 개선 여지다. Critical·Warning 없음.

## 위험도

LOW
