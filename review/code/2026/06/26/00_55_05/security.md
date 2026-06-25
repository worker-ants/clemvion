# 보안(Security) 리뷰

## 발견사항

### INFO — catch 변수명 통일이 에러 노출 패턴에 영향을 주지 않음을 확인

- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/presentation/table/table.handler.ts`, 라인 248–250 (`safeEvaluate` 내부 `logger.error`)
- 상세: 변경 전 `e instanceof Error ? e.stack : String(e)` → 변경 후 `err instanceof Error ? err.stack : String(err)` 로, 식별자 rename 만 이루어졌다. 에러 객체 자체(`err.stack`)를 로그에 기록하는 패턴은 유지되어 있으나, 직전 라인에서 컨텍스트 값을 **키 이름만** 직렬화(`Object.keys(...)`)하는 PII 차단 가드가 이미 존재하며, 이번 변경은 그 가드를 건드리지 않는다. rename 자체는 보안 동작에 영향 없음.

### INFO — `eslint-plugin-unicorn@56.0.1` 신규 의존성 (devDependency)

- 위치: `pnpm-lock.yaml` — `eslint-plugin-unicorn`, `read-pkg-up`, `read-pkg`, `normalize-package-data`, `hosted-git-info`, `semver@5.7.2` 등 추이 의존성 추가
- 상세: 추가된 패키지는 모두 **devDependency** 이므로 프로덕션 번들에 포함되지 않는다. `eslint-plugin-unicorn@56.0.1`의 CVE는 2026-06-26 기준 공개된 것이 없으며, 함께 설치된 `semver@5.7.2`는 구버전이나 이 역시 devDependency 트리 내에만 존재한다. `hosted-git-info@2.8.9`(정규식 ReDoS 이력, CVE-2021-23362)는 `semver@5.7.2`가 직접 의존하는 버전이나 devDependency 전용 도구 체인에만 한정되어 런타임 노출 경로가 없다.
- 제안: 이미 pnpm-lock.yaml overrides 섹션에 프로덕션 취약 패키지에 대한 version pinning 관리가 이루어지고 있다. devDependency 신규 추가 시에도 정기 `pnpm audit --dev` 스캔으로 취약 버전 추이 의존성를 모니터링하는 것을 권장한다. 특히 `hosted-git-info@2.8.9`가 있으므로, CI에서 `--audit-level=moderate` 기준을 적용하거나 해당 패키지의 업그레이드 경로를 확인하면 좋다.

## 요약

이번 변경은 catch 파라미터 명명 통일(`err`)과 이를 강제하는 ESLint 플러그인 추가를 내용으로 하는 순수 유지보수성 리팩터다. 로직·인증·인가·입력 검증·암호화·데이터 흐름 변경이 전혀 없으며, `safeEvaluate`의 PII 차단 가드(`Object.keys`만 로깅)도 그대로 유지된다. 신규 devDependency 체인에 `hosted-git-info@2.8.9`(ReDoS 이력)가 포함되어 있으나, 이는 빌드 도구 전용으로 프로덕션 런타임에 노출되지 않는다. 보안 관점에서 실질적인 위험 요소는 없다.

## 위험도

NONE
