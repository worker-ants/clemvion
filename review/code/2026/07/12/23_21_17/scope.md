# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 커밋의 1차 스코프(§1 Docker devDeps 제거)와 무관한 §2(swagger 핀) 조사 메모가 같은 diff/커밋에 포함됨
  - 위치: `plan/in-progress/pnpm-migration-followups.md` 165-168행 (`## 2. @nestjs/swagger 11.2.7 핀 제거...` 아래 `**조사(2026-07-12, defer)**` 단락)
  - 상세: 이번 작업(커밋 `perf(backend): 프로덕션 Docker 이미지 devDeps 제거`)의 실제 코드 변경은 `codebase/backend/Dockerfile` 의 §1(devDeps prune) 뿐인데, 같은 커밋에 §2(별개 follow-up 항목인 `@nestjs/swagger` 버전 핀 제거)에 대한 조사 결과·defer 사유가 plan 문서에 함께 추가됐다. 코드 변경은 없고 문서 기록만 있어 실질적 영향은 없지만, 엄밀히는 "이번 작업 대상"인 §1 범위를 넘어선 부가 조사 기록이다.
  - 제안: 문제 삼을 수준은 아님(허용 가능). 다만 커밋 메시지가 `§2(swagger 핀)·§3(node-linker strict)·§4(기타)는 조사/defer — plan 참조`라고 명시적으로 고지하고 있고, `pnpm-migration-followups.md` 자체가 §1~§4 를 모두 포괄하는 backlog 문서이자 이번 worktree 의 작업 대상 plan 이므로, 관련 항목 조사 결과를 같은 plan 파일에 기록하는 것은 이 프로젝트의 기존 관례(다른 backlog defer 결정 기록 패턴)와 일치한다. Scope 위반이라기보다 "같은 plan 문서 내 부수 결정 기록"으로 판단.

- 그 외 항목은 스코프 이탈 없음:
  - `codebase/backend/Dockerfile` diff는 plan §1 이 명시한 "옵션 B 변형"(전용 `prod-deps` 스테이지 추가 + `runner` 의 `COPY --from` 소스 교체)만 정확히 구현. 무관한 스테이지·설정 변경 없음.
  - 변경된 주석(`runner` 섹션 상단)은 `COPY --from=builder` → `COPY --from=prod-deps` 로 바뀐 실제 동작 변화를 설명하기 위한 필수 갱신이며, 불필요한 주석 추가/삭제가 아님.
  - `plan/in-progress/pnpm-migration-followups.md` 의 frontmatter(`worktree`, `owner`) 갱신은 워크트리 시작 시 표준 bookkeeping(`ensure-worktree.sh` 관례)이며 임의 변경 아님.
  - §1 항목의 `완료(...)` 노트는 실제 구현 내용·검증 결과(이미지 크기 1.4GB→1.23GB, e2e 253 무회귀)를 정확히 반영해 코드 변경과 1:1 대응.
  - 포맷팅 전용 변경, 미사용 임포트, 무관 설정 파일 변경은 발견되지 않음(Dockerfile 특성상 임포트 항목 해당 없음).

## 요약

이번 diff 는 `codebase/backend/Dockerfile` 에 대한 plan §1("프로덕션 이미지 devDependencies 제거")의 계획된 구현(옵션 B: 전용 `prod-deps` 스테이지)만을 정확히 수행했고, 관련 주석·plan 문서 갱신도 그 구현 사실과 1:1로 대응한다. 유일하게 언급할 만한 점은 같은 커밋에 §2(swagger 핀 제거)에 대한 조사·defer 메모가 plan 문서에 함께 기록된 것인데, 이는 코드 변경이 아니라 문서 기록이며 커밋 메시지에도 명시적으로 고지돼 있고 프로젝트의 기존 backlog defer 기록 관례와 일치해 문제로 보기 어렵다. 전반적으로 요청 범위를 벗어난 리팩토링, 기능 확장, 무관한 파일 수정, 포맷팅 뒤섞임, 불필요한 임포트/설정 변경은 없다.

## 위험도
NONE
