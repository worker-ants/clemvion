# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `path.resolve` 로 링크 타겟을 해석할 때 저장소 루트 하위로 확인(confine)하지 않음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `findBrokenLinksInFiles` 함수 (238행 `path.resolve(path.dirname(f.absPath), pathPart)`)
  - 상세: `../../../etc/passwd` 형태의 상대 링크가 markdown 안에 있으면 리포 밖 경로로 resolve 될 수 있음. 다만 (a) 이 코드는 CI/로컬 전용 vitest 개발 도구로 프로덕션 런타임에 노출되지 않고, (b) 스캔 대상은 이미 커밋된 신뢰 콘텐츠(`spec/**`, 거버넌스 문서, codebase 소스 주석)뿐이며, (c) 판정 결과는 `fs.existsSync` 존재 여부·헤딩 slug 비교에만 쓰이고 파일 내용을 응답으로 노출하지 않음. 신규 추가된 `collectGovernanceMarkdown`/`findBrokenGovernanceLinks` 도 동일한 기존 헬퍼(`findBrokenLinksInFiles`)를 재사용하므로 이번 PR 이 이 표면을 넓히지 않음(직전 `17_52_44` 리뷰에서도 동일하게 지적·수용됨, 실질 공격 표면 없음 결론).
  - 제안: 조치 불필요. 향후 이 결과를 외부에 노출하거나 신뢰되지 않은 입력(예: 사용자 업로드 markdown)을 스캔하는 방향으로 확장될 경우에 한해 `path.resolve` 결과가 리포 루트 하위인지 확인하는 가드를 고려.

- **[INFO]** GitHub Actions 신규 pathspec(`:(glob)*.md`, `.claude/**`)이 워크플로 트리거 범위를 확장
  - 위치: `.github/workflows/spec-link-checks.yml` (`pathspecs:` 블록, `:(glob)*.md` / `.claude/**` 항목)
  - 상세: `permissions: contents: read` 최소 권한은 이번 PR 에서도 유지됨(변경 없음). 신규 job 은 checkout + `pnpm --filter frontend test`(읽기 전용 vitest) 만 수행하고 외부 쓰기·시크릿 사용이 없음. `.claude/**` 가 확장자 무관 트리거라 비-md 변경에도 잡이 자주 도는 부수 효과는 있으나 권한 확대나 인젝션 표면과 무관.
  - 제안: 조치 불필요.

## 하드코딩 시크릿 / 인증·인가 / 입력 검증 / 암호화 / 에러 처리 / 의존성

이번 diff 는 (1) 문서 링크(`.claude/docs/test-wrapper.md`, `spec-coverage/SKILL.md`, `PROJECT.md`) 상대경로 오탈자 수정, (2) `spec/conventions/spec-impl-evidence.md` §4.2 표에 새 검사 scope(3) 서술 추가, (3) `spec-link-integrity.test.ts`/`spec-links.ts` 에 거버넌스 문서(루트 `*.md` + `.claude/**.md`) 링크·앵커 검증 가드 신설, (4) 그 회귀 클래스(`:(glob)` git pathspec 매직의 세그먼트 경계)를 pin 하는 Python 단위테스트 2건 추가, (5) CI 워크플로 pathspec 확장, (6) 배선된 적 없던 `scripts/check-doc-links.py` 삭제, (7) 직전 리뷰 세션(`17_52_44`)의 RESOLUTION/SUMMARY/reviewer 산출물 커밋으로 구성된다. 전부 CI 빌드타임 문서 검증 도구·테스트·spec 문서 편집이며, 사용자 요청을 처리하는 프로덕션 런타임 경로(백엔드 API, 인증/세션, DB 쿼리, 프론트엔드 렌더링 등)를 전혀 건드리지 않는다. 시크릿·자격증명 리터럴, 인증/인가 로직, 사용자 입력 처리 경로, 해시/암호화 사용, 에러 메시지 노출, 의존성 버전 변경이 diff 안에 없다. `subprocess.run`(테스트 헬퍼)은 리스트 인자로만 호출되며 `shell=True` 없음 — 커맨드 인젝션 표면 없음. 삭제된 `check-doc-links.py` 도 순수 로컬 파일시스템 읽기 전용 스크립트였다.

## 요약

이번 diff 는 문서 링크 무결성 CI 가드 확장(거버넌스 문서 스코프 추가) + spec 서술 갱신 + 회귀 테스트 보강으로, 프로덕션 코드·인증/인가·데이터 계층을 전혀 건드리지 않는 개발 도구·CI·문서 변경이다. 유일하게 재확인한 항목(`path.resolve` 미확정 경로)은 직전 리뷰 라운드에서 이미 INFO 로 평가·수용된 기존 패턴이며 이번 PR 이 그 표면을 넓히지 않는다. CI 워크플로의 `permissions: contents: read` 최소 권한도 그대로 유지된다. 실질적 보안 결함 없음.

## 위험도

NONE
