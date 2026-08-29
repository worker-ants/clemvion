# Security Review

## 리뷰 범위

- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `extractLinks()` 재구현 (줄 단위 매칭 → 마스킹된 전문 매칭)
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — 위 재구현에 대한 negative-path 회귀 테스트 추가
- `plan/in-progress/harness-review-gate-followups.md` — plan 문서 갱신 (체크박스 flip + 서술 추가, 코드 변경 없음)

이 모듈은 프로덕션 런타임 코드가 아니라 **개발/테스트 시점에만 도는 사내 문서 링크 무결성 가드**다. 입력은 저장소 자신의 `spec/**`·거버넌스(`*.md`, `.claude/**.md`)·`plan/in-progress/**`·`codebase/**` 소스 파일이며, 신뢰 경계를 넘는 외부 사용자 입력이나 네트워크 요청을 처리하지 않는다. 이 전제 위에서 아래를 점검했다.

## 발견사항

- **[INFO]** 링크 타깃 경로가 `path.resolve` 로 임의 상대경로(`../../..`)를 허용하고 존재 여부만 검사한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `findBrokenLinksInFiles` 함수 (`const resolved = path.resolve(path.dirname(f.absPath), pathPart);` 및 이어지는 `fs.existsSync(resolved)` 호출부. 이 라인은 이번 diff 에서 수정되지 않은 기존 로직이며 전체 파일 컨텍스트 292행 부근)
  - 상세: `pathPart` 는 마크다운 링크의 목적지 문자열을 그대로 쓰며 상위 디렉터리 이탈(`../../../etc/...` 형태)을 막는 정규화·화이트리스트가 없다. 다만 이 값의 출처가 저장소 안의 사람이 작성한 markdown(신뢰 입력)이고, 결과로 노출되는 것도 "존재 여부/DEAD 판정" 뿐 파일 내용이 아니므로 실질적 공격 표면은 없다. 향후 이 헬퍼가 사용자 제출 마크다운(예: 웹채팅 위젯의 사용자 입력 문서, PR 코멘트 등 신뢰되지 않는 소스)에 재사용될 경우에는 경로 탈출/정보노출 벡터가 될 수 있다.
  - 제안: 현재 스코프(devtool, self-audit)에서는 조치 불요. 코멘트로 "이 함수는 신뢰된 in-repo markdown 전용이며 사용자 제출 콘텐츠에 재사용 금지"를 명시해 두면 향후 오용을 예방할 수 있다.

- **[INFO]** 정규식 안전성 확인 (ReDoS 부재)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `const LINK_RE = /\[([^\]]*)\]\(([^)\n]+)\)/g;` (전체 파일 컨텍스트 82행)
  - 상세: 이번 PR 은 줄 단위 매칭을 버리고 마스킹된 전문(全文)을 한 번에 `LINK_RE.exec()` 로 매칭하도록 바꿨다 — 스캔 대상 문자열 길이가 파일 전체로 늘었다. `[^\]]*`·`[^)\n]+` 는 모두 부정 문자 클래스에 대한 단일 정량자로 중첩 정량자(`(a+)+` 류)가 없어 catastrophic backtracking 이 발생하지 않는다. `LINK_RE.lastIndex = 0` 으로 매 호출 재설정하는 것도 올바르다. 성능 문서화 요구(`.claude/docs`)의 실측대로 선형이라는 점을 코드 리뷰 관점에서 재확인했다 — 문제 없음.
  - 제안: 조치 불요(확인 목적의 기록).

- **[INFO]** 테스트 픽스처의 임시 디렉터리 사용은 안전
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — 신규 `describe` 블록들의 `fs.mkdtempSync(path.join(os.tmpdir(), ...))` / `afterAll(() => fs.rmSync(root, { recursive: true, force: true }))`
  - 상세: `mkdtempSync` 는 예측 불가능한 유일 디렉터리명을 만들고, 각 `describe` 가 자신의 `root` 만 삭제한다(상위 경로 고정, 와일드카드 없음). 심볼릭 링크 추적이나 타 프로세스와 공유되는 고정 경로를 쓰지 않아 TOCTOU/경합 문제가 없다.
  - 제안: 조치 불요.

- **[INFO]** `decodeAnchor` 의 에러 처리는 정보 노출 없이 안전하게 폴백한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `function decodeAnchor(anchor: string)` (이번 diff 범위 밖, 컨텍스트 458행경. 변경 없음이나 새 마스킹 로직과 상호작용하는지 확인 차 점검함)
  - 상세: `decodeURIComponent` 실패 시 원본 문자열을 그대로 반환하며 스택트레이스나 내부 경로를 노출하지 않는다. 문제 없음.
  - 제안: 조치 불요.

`plan/in-progress/harness-review-gate-followups.md` 변경분은 서술 문서(체크박스 flip + 뮤테이션 실측 기록)뿐이며 실행 가능한 코드나 시크릿을 포함하지 않는다 — 보안 관점에서 특이사항 없음.

## 요약

이번 변경은 spec-link-integrity 가드의 `extractLinks()` 를 줄 단위 매칭에서 마스킹-전문 매칭으로 재구현한 내부 개발 도구 코드이며, 신뢰 경계를 넘는 사용자 입력을 처리하지 않는다(입력은 저장소 자신의 markdown). 하드코딩된 시크릿, 인젝션(SQL/XSS/커맨드), 인증/인가 로직, 암호화 관련 코드가 전혀 없고, 새로 도입된 정규식(`LINK_RE`)도 중첩 정량자가 없어 ReDoS 위험이 없다. 유일하게 언급할 만한 사항은 기존부터 있던 경로 해석(`path.resolve` + `existsSync`)이 입력을 정규화하지 않는다는 점이지만, 현재 스코프(신뢰된 in-repo markdown 전용 devtool)에서는 실질 위험이 없어 정보성(INFO)으로만 기록한다.

## 위험도

NONE
