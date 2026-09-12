# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 순수 내부 로직 변경
  - 위치: 전체 diff (`package.json`/`pnpm-lock.yaml` 미변경)
  - 상세: 이번 변경 10개 파일 중 어느 것도 `package.json`·lockfile 을 건드리지 않는다
    (`git diff --stat origin/main` 확인 — CHANGELOG·백엔드 서비스/스펙·e2e·plan 문서뿐).
    새 외부 패키지 추가, 버전 변경, 라이선스·취약점·번들 크기 이슈가 발생할 표면 자체가 없다.
  - 제안: 해당 없음 (조치 불필요).

- **[INFO]** 내부 의존성 fan-out — `isUuidShaped` 소비처가 1곳 → 3곳으로 증가
  - 위치: `codebase/backend/src/common/utils/uuid.ts` (게이트 34-35, `export function isUuidShaped`,
    변경 없음·기존 함수) — 새 호출부는 `codebase/backend/src/modules/auth/login-history.service.ts:8,65`
    (import), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:22,178`
    (import·호출)
  - 상세: `isUuidShaped` 는 이미 존재하던 정규식 기반 순수 함수(외부 의존성 0, 다른 내부 모듈
    import 도 0 — 순환 의존 위험 없음)다. 이번 변경으로 `workspace-context.util.ts` 단독 소비에서
    `login-history.service.ts`·`background-runs.service.ts` 두 곳이 추가돼 총 3곳이 됐다. 이 fan-out
    은 `uuid.spec.ts` docstring 에 grep 기반 카운팅 절차(`grep -rn 'isUuidShaped(' ...`)로 명시
    기록되어 있고, `plan/in-progress/keyset-cursor-uuid-validation.md` §B/§D 에도 "적용 범위가
    넓어진다"(원래 JSDoc 은 워크스페이스 헤더 컨텍스트를 주어로 서술) 를 자체적으로 인지·등재해
    두었다. 실제 결함은 아니며, 소비처 증가를 방치하지 않고 다음 확장 시 재계수하도록 앵커를
    남긴 점은 내부 의존성 관리 관점에서 바람직하다.
  - 제안: 조치 불필요. 다만 `isUuidShaped` 소비처가 더 늘어나면(현재 3곳) 함수 JSDoc 을
    "워크스페이스 헤더" 국한 서술에서 좀 더 일반화된 서술로 옮기는 편이 다음 소비처의 오독을
    줄인다 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 관련 항목이
    등재돼 있어 별도 신규 조치 요구는 아니다.

## 요약

이번 변경은 keyset 커서의 id 성분에 대한 UUID 형태 검증을 추가하는 순수 백엔드 로직/테스트/문서
패치로, 새 외부 패키지·버전 변경·라이선스·취약점·번들 크기 영향이 전혀 없다(`package.json`·
lockfile 미변경 확인). 유일하게 의존성 관점에서 언급할 사항은 기존 내부 유틸 `isUuidShaped` 의
소비처가 1곳에서 3곳으로 늘어난 것인데, 이는 순환 의존 위험이 없는 무의존성 순수 함수의 재사용이며
변경 당사자가 스스로 소비처 증가를 캐너리 테스트·plan 문서에 명시적으로 기록해 두어 추적 가능성이
확보되어 있다.

## 위험도

NONE
