# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** CLAUDE.md — worktree 운영 규칙 목록에 e2e 격리 항목 추가
  - 위치: `CLAUDE.md` line 58 (운영 규칙 목록 내 `e2e 인프라는 worktree 별 자동 격리` 항목)
  - 상세: commit message 에 "CLAUDE.md 격리 방식 설명 갱신" 이 명시적으로 포함되어 있으며, 새로 추가된 e2e 격리 동작을 CLAUDE.md 의 Worktree 운영 규칙 목록에 반영한 것은 해당 기능의 자연스러운 문서화 범위에 해당한다. 기존 항목 수정 없이 새 bullet 한 줄만 삽입되었다.
  - 제안: 이상 없음. 의도된 범위 내 변경.

- **[INFO]** Makefile — 헤더 주석 교체 및 `e2e-prune` 타겟 추가
  - 위치: `Makefile` lines 1–35, lines 66–82
  - 상세: 기존 한 줄 주석(`두 compose 파일은 name: top-level key 가 다르므로...`)을 동작 원리 전체를 설명하는 블록 주석으로 교체하고, `COMPOSE_PROJECT` 변수 도출 로직과 `e2e-prune` 타겟이 추가되었다. 모두 commit message 의 선언 범위 안에 있다. `help` 타겟의 `e2e-down` 설명 문구가 "현 worktree 의 e2e 리소스 정리" 로 변경된 것도 격리 도입에 따른 정확도 개선으로 적절하다.
  - 제안: 이상 없음.

- **[INFO]** PROJECT.md — 명령 표에 `e2e-prune` 행 추가 및 격리 설명 단락 추가
  - 위치: `PROJECT.md` lines 511, 516
  - 상세: 새 Makefile 타겟인 `e2e-prune` 이 명령 표에 추가되고, 격리 동작 방식을 설명하는 단락이 삽입되었다. commit message 에 "PROJECT.md … 격리 방식 설명 갱신" 이 명시되어 있어 의도된 변경이다.
  - 제안: 이상 없음.

- **[INFO]** README.md — e2e 격리 인프라 절 내용 확장
  - 위치: `README.md` lines 729–750
  - 상세: `격리 인프라 기반 e2e` 절의 기존 단락을 교체하고, worktree 별 project 명명 규칙·image 공유 방식·`e2e-prune` 안내 주석을 추가하였다. CLAUDE.md 의 단일 진실 원칙에 따라 README.md 는 "제품의 최종 상태"를 서술하도록 규정되어 있어 이 변경은 적절하다.
  - 제안: 이상 없음.

- **[INFO]** docker-compose.e2e.yml — `name:` 제거, `image:` 명시, 헤더 주석 교체
  - 위치: `docker-compose.e2e.yml` (헤더 주석 전체, `name: clemvion-e2e` 삭제, `migrate`/`backend-e2e`/`backend-e2e-runner` 에 `image:` 추가)
  - 상세: commit message 에서 선언한 핵심 변경 두 가지(name 제거, image 명시)가 정확히 반영되어 있다. 헤더 주석은 삭제된 `name:` 동작 설명을 새 격리 방식 설명으로 교체한 것으로 의미 있는 주석 변경이다.
  - 제안: 이상 없음.

## 요약

이번 커밋(`fix(e2e): isolate docker compose project per worktree`)은 commit message 에 선언한 5가지 변경 — `docker-compose.e2e.yml` name 제거, `Makefile` COMPOSE_PROJECT 도출, 서비스별 `image:` 명시, `e2e-prune` 타겟 추가, 문서 3종(PROJECT.md/README.md/CLAUDE.md) 갱신 — 과 실제 diff 가 1:1 로 일치한다. 관련 없는 파일 수정, 불필요한 리팩토링, 포맷팅만의 변경, 미사용 임포트 추가, 의도하지 않은 설정 파일 변경은 발견되지 않았다. 변경 범위 관점에서 문제가 없다.

## 위험도

NONE
