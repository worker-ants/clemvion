# 보안(Security) 코드 리뷰

## 리뷰 범위

`doclink-guard-scope` PR — 문서 링크 무결성 가드(scope 3: 거버넌스 문서)를 신설하고, 배선되지 않은
채 방치되던 `scripts/check-doc-links.py` 를 삭제, CI 워크플로(`spec-link-checks.yml`)의
`pathspecs` 를 확장한 변경. 대상 파일 9개는 전부 CI 설정(yml)·테스트 코드(ts/py)·문서(md) 이며,
런타임 애플리케이션 코드(백엔드 API·프론트엔드 렌더링 경로 등)는 포함되지 않는다.

## 발견사항

없음. 아래는 참고용 INFO 관찰 사항이다.

- **[INFO]** `findBrokenLinksInFiles` 의 상대경로 target 을 `path.resolve` 로 해석해 `fs.existsSync`/`fs.readFileSync` 로 존재·헤딩을 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 함수 `findBrokenLinksInFiles` (라인 238 부근, `const resolved = path.resolve(...)`)
  - 상세: 마크다운 링크의 `target` 문자열(`../../etc/passwd` 류)을 검증 없이 `path.resolve` 로 해석하므로 이론상 리포 밖 경로도 가리킬 수 있다. 다만 (a) 이 코드는 CI/로컬 vitest 로만 실행되는 개발 도구이고 외부 입력을 받지 않으며, (b) 입력은 이미 리포에 커밋된(따라서 쓰기 권한을 가진 기여자만 조작 가능한) markdown 파일의 내용이고, (c) 파일 내용을 응답으로 반환하지 않고 존재 여부/헤딩 슬러그만 비교에 사용한다 — 실질적 공격 표면이 없다.
  - 제안: 조치 불필요. 향후 이 함수가 파일 내용을 외부로 노출하는 방향으로 확장될 경우에만 경로가 리포 루트 하위인지 검증하는 방어를 고려.

- **[INFO]** `.github/workflows/spec-link-checks.yml` 은 이번 변경에서도 `permissions: contents: read` 를 유지 — 최소 권한 원칙 준수. 신규 pathspec 추가(`:(glob)*.md`, `.claude/**`)가 권한 상승이나 시크릿 노출을 동반하지 않음을 확인.
- **[INFO]** 신규 vitest fixture(`spec-link-integrity.test.ts`)는 `fs.mkdtempSync(path.join(os.tmpdir(), "gov-scope-"))` 로 예측 불가능한 임시 디렉터리를 만들고 `afterAll` 에서 `rmSync({recursive:true, force:true})` 로 정리한다. 심볼릭 링크 공격이나 경합 조건에 노출될 시크릿·권한 상승 지점이 없다.
- **[INFO]** `scripts/check-doc-links.py` 삭제는 순수 dead-code 제거(어떤 CI/hook 도 호출하지 않았음이 커밋 메시지·plan 문서에 실측으로 명시됨) — 보안에 영향 없음.

## 요약

이번 변경 세트는 문서 링크 무결성을 검증하는 개발/CI 도구 계층에 국한되며, 인증·인가, 사용자 입력 처리, 시크릿 관리, 암호화, 외부 노출 API 등 OWASP Top 10 관련 표면을 건드리지 않는다. 파일 경로 해석 로직(`spec-links.ts`)이 존재하지만 신뢰된 리포지토리 콘텐츠만 소비하고 결과를 존재 여부 비교에만 사용하므로 실질적 취약점으로 이어지지 않는다. CI 워크플로의 `permissions` 도 최소 권한(`contents: read`)을 그대로 유지한다. Critical/Warning 수준의 보안 결함은 발견되지 않았다.

## 위험도
NONE
