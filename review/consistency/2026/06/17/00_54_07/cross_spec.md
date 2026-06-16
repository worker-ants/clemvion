# Cross-Spec 일관성 검토 결과

**검토 모드**: 구현 완료 후 (`--impl-done`, scope=`spec/7-channel-web-chat`, diff-base=`origin/main`)
**검토 대상**: `spec/7-channel-web-chat/**` + 관련 구현 변경 (`codebase/backend`, `codebase/channel-web-chat`)

---

## 발견사항

### [WARNING] isolated-vm Node.js 버전 표기 — spec 과 실제 최소 요건 불일치
- **target 위치**: `codebase/backend/package.json` `engines.node = ">=24"` (PR 추가)
- **충돌 대상**: `spec/4-nodes/5-data/2-code.md` §Rationale 트레이드오프 섹션 (line 470): `"isolated-vm 버전은 node>=22 를 지원하는 6.x 라인을 사용한다"`
- **상세**: PR이 `backend/package.json`에 `"engines": { "node": ">=24" }`를 추가함으로써 런타임 최소 요건이 Node 24로 상향됐다. 그러나 spec은 여전히 `isolated-vm 6.x`가 `node>=22`를 지원한다고 기술한다. `isolated-vm 6.x`가 Node 24에서 동작하는 것은 기술적으로 참이지만, spec이 `node>=22`를 사실상 최소 요건으로 암시하는 반면 배포 환경은 이제 `node>=24`를 강제한다. 두 문서를 모두 읽는 독자는 "Node 22에서 배포 가능한가"를 혼동할 수 있다.
- **제안**: `spec/4-nodes/5-data/2-code.md` §Rationale 트레이드오프 섹션의 `isolated-vm 버전은 node>=22 를 지원하는 6.x 라인을 사용한다` 문구를 `"isolated-vm 6.x 라인을 사용한다 (node>=22 지원, 프로젝트 최소 요건은 node>=24 — package.json engines 참조)"` 형태로 갱신해 혼동을 제거한다.

---

### [INFO] spec/7-channel-web-chat/4-security.md frontmatter — safe-html.ts code 참조 누락
- **target 위치**: `spec/7-channel-web-chat/4-security.md` `code:` frontmatter
- **충돌 대상**: 없음 (누락 표기)
- **상세**: PR 변경으로 `§1 입력 sanitize` 행이 DOMPurify `ALLOWED_TAGS`/`ALLOWED_ATTR`/`ALLOWED_URI_REGEXP` 정책을 명시하게 됐다. 이 정책의 실제 구현 파일은 `codebase/channel-web-chat/src/lib/safe-html.ts`인데, spec frontmatter `code:` 목록에 등재되지 않았다. 다른 spec 영역과 모순은 없으나, spec-impl coverage 추적 도구가 해당 파일을 이 spec의 근거 코드로 인식하지 못한다.
- **제안**: `spec/7-channel-web-chat/4-security.md` frontmatter의 `code:` 섹션에 `codebase/channel-web-chat/src/lib/safe-html.ts` 항목을 추가한다.

---

### [INFO] otplib v12→v13 메이저 업그레이드 — spec 데이터 모델과 호환성
- **target 위치**: `codebase/backend/package.json` `otplib: "^13.4.1"` + `codebase/backend/src/modules/auth/totp.service.ts`
- **충돌 대상**: `spec/1-data-model.md §2.1 User.two_factor_secret`: `"TOTP secret (otplib base32)"`
- **상세**: otplib v13은 base32 secret 형식과 RFC 6238 TOTP 계산 알고리즘을 v12와 동일하게 유지한다. PR의 `totp.service.spec.ts`에 `cross-version 호환성 (otplib v12→v13)` 테스트 스위트가 추가되어 기존 사용자 secret(`RFC6238_SECRET_B32`)의 검증이 v13에서도 동일하게 동작함을 확인한다. `spec/5-system/1-auth.md`가 서술하는 `TOTP Google Authenticator 호환 + 6자리 코드 + 30초 step` 동작은 변경되지 않는다. 데이터 모델 충돌 없음.
- **제안**: 동작은 일치하므로 spec 변경 불요. 다만 `spec/1-data-model.md §2.1`의 `(otplib base32)` 코멘트에서 `otplib` 버전 명시를 삭제하거나 `(base32 — RFC 6238 호환)`으로 라이브러리 무관 표기로 전환하는 것을 권장한다.

---

### [INFO] @types/node v22→v24 업그레이드 — spec 관련 영역 없음
- **target 위치**: `codebase/backend/package.json` `"@types/node": "^24"` + `codebase/channel-web-chat/package.json` `"@types/node": "^24"`
- **충돌 대상**: 없음
- **상세**: `@types/node` 버전 변경은 TypeScript 타입 정의 갱신이며 런타임 동작 변경이 아니다. 어떤 spec 영역의 API 계약·데이터 모델·상태 전이 정의와도 모순되지 않는다.
- **제안**: 없음.

---

## 요약

이번 변경의 주 spec 영역(`spec/7-channel-web-chat/4-security.md`)은 기존 spec과 직접 모순되지 않는다. 단 `codebase/backend/package.json`에 `engines.node = ">=24"`가 추가된 것이 `spec/4-nodes/5-data/2-code.md`의 `isolated-vm 6.x (node>=22)` 기술과 표기 불일치를 만들어낸다 — 실제 배포 최소 요건이 Node 24로 높아졌으나 spec 문구는 여전히 22를 최소로 암시한다. 이 불일치는 두 영역 중 하나를 작동 불가로 만드는 수준이 아니므로 WARNING으로 분류하지만, 셀프호스팅 배포자가 오독해 Node 22 환경에 배포할 수 있으므로 spec 동기화가 권장된다.

## 위험도

LOW
