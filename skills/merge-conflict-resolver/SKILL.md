---
name: merge-conflict-resolver
description: Dùng khi Git đang có conflict merge, rebase, cherry-pick hoặc stash-pop, có conflict marker hay Unmerged paths. Bỏ qua khi chưa có conflict thật hoặc file generated/build có thể regenerate.
---

# Merge Conflict Resolver

## Contract

Khôi phục intent của hai phía rồi hòa giải. Mỗi resolution phải là intent A, intent B hoặc hợp tương thích
của cả hai; không bịa behavior thứ ba. Chỉ chạm vùng conflict và phần tối thiểu bị resolution làm vỡ.

## Quy trình

1. Đọc `git status`, operation hiện tại và danh sách unmerged. Đọc toàn bộ file conflict và lịch sử liên
   quan (`git log -p --follow`, `git blame`) để hiểu why của hai phía.
2. Với Kotlin/code, dùng graph-first để trace symbol/caller. Với config/docs/literal dùng Read/Grep.
   Kiểm `.Codex/memory/` nếu một phía chứa bug prevention đã biết.
3. Resolve từng hunk, xóa marker. Nếu hai intent mâu thuẫn không thể dung hòa, chọn theo mục tiêu đã
   tuyên bố của operation; nếu mục tiêu không suy ra an toàn và behavior khác đáng kể, hỏi User.
4. Verify vùng đụng: marker search, targeted compile/test và ktlint; detekt khi logic/risk cần. Không
   claim xanh nếu command chưa chạy.
5. `git add` đúng các conflict file đã resolve để ghi checkpoint; không stage file ngoài scope.

## Git safety

- Không `--abort`, reset, restore/revert user work trừ khi User yêu cầu rõ.
- Không commit, `rebase --continue`, `cherry-pick --continue`, push hoặc thay đổi history nếu request
  hiện tại chưa yêu cầu hoàn tất operation.
- Nếu User đã yêu cầu hoàn tất, tiếp tục từng conflict kế và lặp verify.
- Bàn giao đúng `git status`, trade-off và lệnh kế tiếp; không tạo approval prompt mặc định.

Terminal: không còn marker/unmerged trong scope, intent truy được, checks đã chạy được báo đúng và
dirty/staged state được nêu chính xác.

Liên kết: [[rulebook/22-git-conventions]] · [[rulebook/17-testing]].
