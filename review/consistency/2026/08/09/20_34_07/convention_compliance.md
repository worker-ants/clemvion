# 정식 규약 준수 검토 — `spec/5-system/` (--impl-prep)

## 검토 범위

번들에 전문이 포함된 target: `spec/5-system/1-auth.md`, `spec/5-system/2-api-convention.md`,
`spec/5-system/3-error-handling.md` (나머지 `spec/5-system/*.md` 15개는 예산 초과로 목록만
제공됨 — 본문 미확인). 대조 규약: `spec/conventions/**` 전체(번들에 없는
`error-codes.md`·`swagger.md`·`spec-impl-evidence.md`·`audit-actions.md` 는 파일시스템에서
직접 `Read` 하여 대조). 특히 최근 커밋(`602f677cd` "auth 불변식 5곳 spec 동기화 — #1103·
#1108·#1109 이 결정만 하고 안 적은 것")이 만든 신규 내용(부트 캐너리 Rationale, `X-Workspace-Id`
UUID 검증 강도 비대칭, §1.3 `VALIDATION_ERROR` 신규 행)을 중점 대조했다 — 이 세션이
`plan/in-progress/auth-guard-reflection-hardening.md` 의 "developer 범위" 백로그
(`workspace-reflection-canary.ts` 캐너리 주석 "73건" 수치 정정 등, docstring fix)를
준비하는 --impl-prep 이기 때문이다.

## 발견사항

- **[INFO] `2-api-convention.md` 에 명시적 `## Overview` 섹션 없음**
  - target 위치: `spec/5-system/2-api-convention.md` 상단 (`# Spec: API 설계 규칙` 직후
    바로 `## 1. 기본 원칙` 로 진입, `## Overview` 헤더 없음)
  - 위반 규약: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
    (`spec/conventions/**` 자체 문서는 아니나 프로젝트 공통 문서 구조 규약).
    같은 폴더의 형제 문서 `1-auth.md`(§Overview, L54)·`3-error-handling.md`(§Overview,
    L1362)는 모두 명시적 `## Overview` 를 갖고 있어 이 파일만 예외다.
  - 상세: "권장" 조항이라 CRITICAL/WARNING 은 아니며, 이번 세션 diff 가 만든 문제도
    아니다(사전 존재). `> 관련 문서: ...` 블록쿼트가 사실상 Overview 역할을 일부 대신하고
    있으나 헤더가 없어 `spec-area-index`/문서 파싱 관례상 형제 문서와 구조가 다르다.
  - 제안: 이번 docstring-fix 작업 범위 밖이므로 즉시 수정 불요. 추후 `2-api-convention.md`
    를 건드릴 기회가 있으면 `## Overview` 섹션을 신설해 형제 문서와 구조를 맞출 것.

- **[INFO] `3-error-handling.md §1.3` 같은 테이블에 `VALIDATION_ERROR` 코드가 두 행으로 등재**
  - target 위치: `spec/5-system/3-error-handling.md §1.3 유효성 검증 에러` 표
    (일반 `VALIDATION_ERROR` 행 + `X-Workspace-Id` 형식 오류 전용 `VALIDATION_ERROR` 행)
  - 위반 규약: 없음(확인 결과 위반 아님) — `error-codes.md §1` 은 `VALIDATION_ERROR` 를
    "시스템 전역 공용 코드" 로 도메인-prefix 원칙의 명시적 예외 범주로 규정하므로, 같은
    코드를 여러 트리거에 재사용하는 것 자체는 규약 위반이 아니다. 동일 문서 `15-chat-channel.md`
    §5.4 에서도 "§5.4.1 의 동명 코드와는 같은 코드 다른 트리거" 식으로 코드 재사용을 명시적으로
    구분·주석하는 선례가 이미 있어, 이번 두 행 분리도 그 관행과 일치한다.
  - 상세: 다만 이 저장소의 §1.3 다른 항목들(`MODEL_CONFIG_NOT_FOUND`, `DUPLICATE_NODE_LABEL`,
    `RESERVED_VARIABLE_NAME` 등)은 보통 "일반 코드의 특화 코드" 를 **새 이름**으로 만드는
    패턴이 더 흔했다 — 이번 건은 "새 코드 신설 = `3-error-handling.md` 갱신 필요 = 당시
    `spec_impact: none` 과 모순" 이라는 **프로세스 제약**이 실제 채택 사유였다
    (`plan/in-progress/auth-guard-reflection-hardening.md §3`). 결과적으로 지금은 그 spec 이
    갱신됐으니 제약이 해소됐지만, 코드 재사용 자체는 남아 있다.
  - 제안: 규약 위반은 아니므로 조치 불필요. 가독성 참고로만, §1.3 표 상단에 "동일 코드가
    여러 행에 걸쳐 등재될 수 있다" 는 1줄 노트를 추가하면 이후 신규 기여자가 테이블을
    "code 가 유일 키" 라고 오독하는 것을 예방할 수 있다(선택 사항).

- **[INFO] (참고, 엄밀히는 본 checker 관할 밖) `common/utils/uuid.ts` docstring 이 방금 정정된
  spec 근거를 아직 반영하지 않음**
  - target 위치: 코드 `codebase/backend/src/common/utils/uuid.ts` L20-26 (spec 문서 아님 —
    본 checker 는 `spec/5-system/` 대상이라 엄밀 범위 밖이나, 이번 --impl-prep 이 준비하는
    작업(docstring fix)과 직결돼 참고로 남긴다)
  - 위반 규약: 해당 없음(spec/conventions 규약 위반이 아니라 spec-code 정합성 이슈 — 다른
    checker(rationale_continuity/cross_spec) 관할에 더 가깝다)
  - 상세: `uuid.ts` 는 "실제로 이 저장소의 e2e 하나가 nil UUID 를 타 워크스페이스 프로브로
    쓴다(`system-status.e2e-spec.ts`)" 를 `isUuidShaped` 설계 근거로 여전히 인용한다. 그러나
    이번 세션이 반영한 `spec/data-flow/12-workspace.md` §Rationale "캐너리 지목 정정" 은 그
    e2e 가 실제로는 이 술어에 닿지 않는다고 이미 정정했다(`system-status` 컨트롤러에
    `@Roles()`/`@WorkspaceId()` 가 없어 `RolesGuard` 가 헬퍼 호출 전에 통과시킴) — 진짜
    캐너리는 `uuid.spec.ts`(술어 경계)·`workspace-context.util.spec.ts`(nil UUID 통과)
    단위 테스트 두 건이라고 명시했다. `workspace-context.util.ts` 는 이미 이 정정을 반영해
    해당 e2e 를 인용하지 않는데, `uuid.ts` 만 구 근거를 그대로 갖고 있다.
  - 제안: 뒤따를 구현(docstring fix) 세션에서 `uuid.ts` L20-26 을 spec 의 정정된 문구에
    맞춰 갱신할 것(두 단위 테스트를 근거로 인용, e2e 인용 제거). spec 쪽은 이미 정정 완료
    상태라 spec 수정은 불필요 — code 쪽만 따라가면 된다.

## 요약

`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` (target 전문 확인분)는
`spec/conventions/**`(명명·에러코드·swagger·audit-actions·spec-impl-evidence) 대비 CRITICAL/
WARNING 급 위반이 없다. 최근 커밋이 신설한 부트 캐너리 Rationale·`X-Workspace-Id` UUID 검증
강도 비대칭 서술·`VALIDATION_ERROR` 신규 행은 모두 `error-codes.md`(의미 기반 명명·전역 공용
코드 예외)·`spec-impl-evidence.md`(`code:` 글로브 스키마)·문서 3섹션 구조를 준수하며, 코드
심볼명(`assertWorkspaceIdReflectionWorks`·`isUuidShaped`·`resolveRequestWorkspaceContext`
등)도 실제 구현과 정확히 일치함을 파일 대조로 확인했다. 발견된 항목은 전부 INFO 등급의
사전 존재 구조 편차 또는 참고 노트이며, 이번 세션 diff 가 새로 만든 위반은 없다.

## 위험도

LOW
